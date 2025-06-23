/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/record', 'N/search', 'N/runtime'],
    (record, search, runtime) => {

        /**
         * Main Suitelet entry point.
         * @param {Object} context - Suitelet context object.
         */
        const onRequest = (context) => {
            try {
                const {request, response} = context;
                const {parameters, method} = request;

                if (method !== 'GET') {
                    log.error('Invalid Method', method);
                    response.write(JSON.stringify({success: false, message: 'Only GET method is supported'}));
                    return;
                }

                const recordId = parameters.recordId;
                if (!recordId) {
                    log.error('Missing Parameter', 'recordId is required');
                    response.write(JSON.stringify({success: false, message: 'Missing recordId parameter'}));
                    return;
                }

                const consignmentId = createConsignment(recordId);
                if (!consignmentId) {
                    log.error('Consignment Creation Failed', 'Could not create consignment record');
                    response.write(JSON.stringify({success: false, message: 'Failed to create consignment'}));
                    return;
                }

                const receiveConsignmentId = createReceiveConsignment(consignmentId);
                if (!receiveConsignmentId) {
                    log.error('Receive Consignment Creation Failed', 'Could not create receive consignment');
                    response.write(JSON.stringify({success: false, message: 'Failed to create receive consignment'}));
                    return;
                }

                createInventoryAdjustment(receiveConsignmentId);

                const releaseOrderId = createReleaseOrder(receiveConsignmentId);
                if (!releaseOrderId) {
                    log.error('Release Order Creation Failed', 'Could not create release order');
                    response.write(JSON.stringify({success: false, message: 'Failed to create release order'}));
                    return;
                }

                response.write(JSON.stringify({
                    success: true,
                    releaseOrderId
                }));

            } catch (error) {
                log.error('Error in Suitelet', error);
                context.response.write(JSON.stringify({success: false, error: error.message}));
            }
        };

        /**
         * Creates a consignment record from an Item Fulfillment.
         * @param {string|number} paramData - Item Fulfillment internal ID.
         * @returns {string|number|null} Consignment record ID or null on failure.
         */
        function createConsignment(paramData) {
            try {
                if (!paramData) {
                    log.error('createConsignment', 'paramData is required');
                    return null;
                }

                const currentRecord = record.load({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: paramData,
                });

                const consignmentRecord = record.create({
                    type: "custompurchase_srp_3pl_purchase_order",
                    isDynamic: true,
                });

                // Set main fields
                consignmentRecord.setValue({fieldId: 'entity', value: currentRecord.getValue({fieldId: 'entity'})});
                consignmentRecord.setValue({
                    fieldId: 'subsidiary',
                    value: runtime.getCurrentScript().getParameter({name: "custscript_hbno_3pl_cnsgnmt_subsdiary"})
                });
                consignmentRecord.setValue({
                    fieldId: 'location',
                    value: runtime.getCurrentScript().getParameter({name: "custscript_hbno_3pl_cnsgnmt_location"})
                });
                consignmentRecord.setValue({
                    fieldId: 'custbody_srp_createdfromsample_so',
                    value: currentRecord.getValue({fieldId: 'createdfrom'})
                });
                consignmentRecord.setValue({fieldId: 'custbody_created_form', value: paramData});
                consignmentRecord.setValue({fieldId: 'trandate', value: currentRecord.getValue({fieldId: 'trandate'})});
                consignmentRecord.setValue({fieldId: 'transtatus', value: 'B'});

                const lineCount = currentRecord.getLineCount({sublistId: 'item'});

                // --- Batch SO item rates/amounts ---
                const createdfrom = currentRecord.getValue({fieldId: 'createdfrom'});
                const itemIds = [];
                for (let i = 0; i < lineCount; i++) {
                    const item = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                    if (item && !itemIds.includes(item)) itemIds.push(item);
                }
                const soRates = getSoRates(createdfrom, itemIds);
                // --- End batch SO item rates/amounts ---

                // --- Gather all bin numbers from all inventory detail lines ---
                const allBinNumbers = new Set();
                for (let i = 0; i < lineCount; i++) {
                    let currentSubrecord = null;
                    try {
                        currentSubrecord = currentRecord.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: i
                        });
                    } catch (e) {
                        log.debug('No inventorydetail subrecord for line', {line: i, error: e.message});
                    }
                    if (currentSubrecord) {
                        const inventoryDetailLineCount = currentSubrecord.getLineCount({sublistId: 'inventoryassignment'});
                        for (let count = 0; count < inventoryDetailLineCount; count++) {
                            const binnumber = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: count
                            });
                            if (binnumber) {
                                allBinNumbers.add(binnumber);
                            }
                        }
                    }
                }

                // --- Batch map bin numbers to 3PL bins ---
                const default3plBin = runtime.getCurrentScript().getParameter({name: "custscript_hbno_3pl_create_hbno_bin"});
                const binMap = getBinMap(Array.from(allBinNumbers), default3plBin);

                for (let i = 0; i < lineCount; i++) {
                    consignmentRecord.selectNewLine({sublistId: 'item'});

                    const item = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                    const quantity = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});

                    // Validate item and quantity
                    if (!item || !quantity) {
                        log.error('Invalid Item/Quantity', {item, quantity, line: i});
                        continue;
                    }

                    consignmentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        value: item,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true
                    });
                    consignmentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        value: quantity,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true
                    });

                    // Use batch SO search results
                    let rate = 1, amount = 1;
                    if (soRates[item]) {
                        rate = soRates[item].rate;
                        amount = soRates[item].amount;
                    }

                    consignmentRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate});
                    consignmentRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: amount});

                    // Copy inventory detail if present
                    let currentSubrecord = null;
                    try {
                        currentSubrecord = currentRecord.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: i
                        });
                    } catch (e) {
                        log.debug('No inventorydetail subrecord for line', {line: i, error: e.message});
                    }

                    if (currentSubrecord) {
                        const inventorySubrecord = consignmentRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                        });

                        const inventoryDetailLineCount = currentSubrecord.getLineCount({sublistId: 'inventoryassignment'});
                        for (let count = 0; count < inventoryDetailLineCount; count++) {
                            inventorySubrecord.selectNewLine({sublistId: 'inventoryassignment'});

                            // Lot/serial number
                            const lotnoText = currentSubrecord.getSublistText({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: count
                            });
                            if (lotnoText) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'receiptinventorynumber',
                                    value: lotnoText
                                });
                            }
                            const lotnoValue = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: count
                            });
                            if (lotnoValue) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    value: lotnoValue
                                });
                            }

                            // Bin number (use batch map)
                            let binnumber = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: count
                            });
                            let mappedBin = default3plBin;
                            if (binnumber && binMap[binnumber]) {
                                mappedBin = binMap[binnumber];
                            }
                            if (binnumber) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'binnumber',
                                    value: mappedBin
                                });
                            }

                            // Quantity
                            const invQuantity = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                line: count
                            });
                            if (invQuantity) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    value: invQuantity
                                });
                            }

                            inventorySubrecord.commitLine({sublistId: 'inventoryassignment'});
                        }
                    }

                    consignmentRecord.commitLine({sublistId: 'item'});
                }

                const consignmentRecordId = consignmentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                // Link consignment to fulfillment
                record.submitFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: paramData,
                    values: {'custbody_created_form': consignmentRecordId},
                    options: {enableSourcing: false, ignoreMandatoryFields: true}
                });
                return consignmentRecordId;

            } catch (e) {
                log.error('createConsignment Exception', e);
                return null;
            }
        }

        /**
         * Transforms a consignment record into a receive consignment record.
         * @param {string|number} consignmentId
         * @returns {string|number|null} Receive consignment record ID or null on failure.
         */
        function createReceiveConsignment(consignmentId) {
            try {
                if (!consignmentId) {
                    log.error('createReceiveConsignment', 'consignmentId is required');
                    return null;
                }

                const newRecord = record.transform({
                    fromType: "custompurchase_srp_3pl_purchase_order",
                    fromId: consignmentId,
                    toType: "custompurchase_srp_r3plo",
                    isDynamic: true,
                });

                newRecord.setValue({
                    fieldId: "custbodycustbody158",
                    value: consignmentId,
                });

                const receiveConsignmentId = newRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                return receiveConsignmentId;
            } catch (e) {
                log.error('createReceiveConsignment Exception', e);
                return null;
            }
        }

        /**
         * Creates an inventory adjustment for the receive consignment if not already present.
         * @param {string|number} receiveConsignment
         */
        function createInventoryAdjustment(receiveConsignment) {
            try {
                if (!receiveConsignment) {
                    log.error('createInventoryAdjustment', 'receiveConsignment is required');
                    return;
                }

                const currentRecord = record.load({
                    type: 'custompurchase_srp_r3plo',
                    id: receiveConsignment
                });

                const purchaseOrderId = currentRecord.getValue("createdfrom");

                // Check if adjustment already exists
                const inventoryAdjustmentSearchObj = search.create({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    filters: [
                        ["custbody_srp3plpurchaseorder", "anyof", purchaseOrderId]
                    ],
                    columns: ["internalid"]
                });
                const searchResult = inventoryAdjustmentSearchObj.run().getRange({start: 0, end: 1});
                if (searchResult && searchResult.length > 0) {
                    return;
                }

                // Create inventory adjustment
                const inventoryAdjustmentRecord = record.create({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    isDynamic: true,
                });

                inventoryAdjustmentRecord.setValue({
                    fieldId: "subsidiary",
                    value: currentRecord.getValue("subsidiary"),
                });
                inventoryAdjustmentRecord.setValue({
                    fieldId: "custbody_srp3plpurchaseorder",
                    value: purchaseOrderId,
                });
                inventoryAdjustmentRecord.setValue({
                    fieldId: 'account',
                    value: runtime.getCurrentScript().getParameter({
                        name: "custscript_hbno_3pl_account_shrinkage"
                    })
                });

                const lineCount = currentRecord.getLineCount({sublistId: "item"});
                for (let i = 0; i < lineCount; i++) {
                    const item = currentRecord.getSublistValue({sublistId: "item", fieldId: "item", line: i});
                    const quantity = currentRecord.getSublistValue({sublistId: "item", fieldId: "quantity", line: i});
                    const location = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'location', line: i});

                    if (!item || !quantity || !location) {
                        log.error('Invalid Inventory Line', {item, quantity, location, line: i});
                        continue;
                    }

                    inventoryAdjustmentRecord.selectNewLine({sublistId: "inventory"});
                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "item",
                        value: item
                    });
                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "adjustqtyby",
                        value: quantity
                    });
                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "location",
                        value: location
                    });

                    // Copy inventory detail if present
                    let inventoryDetailSubrecord = null;
                    try {
                        inventoryDetailSubrecord = currentRecord.getSublistSubrecord({
                            sublistId: "item",
                            fieldId: "inventorydetail",
                            line: i,
                        });
                    } catch (e) {
                        log.debug('No inventorydetail subrecord for inventory line', {line: i, error: e.message});
                    }

                    if (inventoryDetailSubrecord) {
                        const inventoryDetailLineCount = inventoryDetailSubrecord.getLineCount({sublistId: "inventoryassignment"});
                        const adjustInventoryDetailSubrecord = inventoryAdjustmentRecord.getCurrentSublistSubrecord({
                            sublistId: "inventory",
                            fieldId: "inventorydetail",
                        });

                        for (let j = 0; j < inventoryDetailLineCount; j++) {
                            adjustInventoryDetailSubrecord.selectNewLine({sublistId: "inventoryassignment"});

                            const receiptinventorynumber = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "receiptinventorynumber",
                                line: j,
                            });
                            const binNumber = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "binnumber",
                                line: j,
                            });
                            const inventoryQuantity = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "quantity",
                                line: j,
                            });

                            if (receiptinventorynumber) {
                                adjustInventoryDetailSubrecord.setCurrentSublistText({
                                    sublistId: "inventoryassignment",
                                    fieldId: "receiptinventorynumber",
                                    text: receiptinventorynumber
                                });
                            }
                            if (binNumber) {
                                adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                    sublistId: "inventoryassignment",
                                    fieldId: "binnumber",
                                    value: binNumber
                                });
                            }
                            if (inventoryQuantity) {
                                adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                    sublistId: "inventoryassignment",
                                    fieldId: "quantity",
                                    value: inventoryQuantity
                                });
                            }

                            adjustInventoryDetailSubrecord.commitLine({sublistId: "inventoryassignment"});
                        }
                    }

                    inventoryAdjustmentRecord.commitLine({sublistId: "inventory"});
                }

                const adjustmentRecordId = inventoryAdjustmentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                });

                if (adjustmentRecordId) {
                    record.submitFields({
                        type: "custompurchase_srp_r3plo",
                        id: receiveConsignment,
                        values: {custbody_srp_linked_inventory_adj: adjustmentRecordId},
                        options: {enableSourcing: false, ignoreMandatoryFields: true}
                    });
                }

            } catch (e) {
                log.error("createInventoryAdjustment Exception", e);
            }
        }

        /**
         * Creates a release order from the receive consignment.
         * @param {string|number} receiveConsignment
         * @returns {string|number|null} Release order ID or null on failure.
         */
        function createReleaseOrder(receiveConsignment) {
            try {
                if (!receiveConsignment) {
                    log.error('createReleaseOrder', 'receiveConsignment is required');
                    return null;
                }

                const currentRecord = record.load({
                    type: 'custompurchase_srp_r3plo',
                    id: receiveConsignment,
                });

                const createRecord = record.create({
                    type: "customsale_srp_3_pl_salesorder",
                    isDynamic: true,
                });

                createRecord.setValue({
                    fieldId: 'customform',
                    value: runtime.getCurrentScript().getParameter({name: "custscript_hbno_3pl_connected_shipment_f"})
                });
                createRecord.setValue({fieldId: 'entity', value: currentRecord.getValue({fieldId: 'entity'})});
                createRecord.setValue({fieldId: 'subsidiary', value: currentRecord.getValue({fieldId: 'subsidiary'})});
                createRecord.setValue({fieldId: 'transtatus', value: 'E'});
                createRecord.setValue({
                    fieldId: 'custbody_srp_createdfromsample_so',
                    value: currentRecord.getValue({fieldId: 'custbody_srp_createdfromsample_so'})
                });
                createRecord.setValue({fieldId: 'custbody_created_form', value: receiveConsignment});

                // Set location from createdfrom record
                const createdfrom = currentRecord.getValue({fieldId: 'createdfrom'});
                if (createdfrom) {
                    const createdfromRecord = search.lookupFields({
                        type: "custompurchase_srp_3pl_purchase_order",
                        id: createdfrom,
                        columns: ['location']
                    });
                    if (createdfromRecord.location && createdfromRecord.location[0] && createdfromRecord.location[0].value) {
                        createRecord.setValue({fieldId: 'location', value: createdfromRecord.location[0].value});
                    }
                }

                // --- Set tranid before saving ---
                let tranid = '';
                const soId = currentRecord.getValue({fieldId: 'custbody_srp_createdfromsample_so'});
                if (soId) {
                    const salesorderRecord = search.lookupFields({
                        type: record.Type.SALES_ORDER,
                        id: soId,
                        columns: ['tranid']
                    });
                    if (salesorderRecord.tranid) {
                        // Build base tranid
                        let baseTranid = salesorderRecord.tranid + '-3PL';
                        tranid = baseTranid;
                        // Ensure uniqueness
                        let suffix = 1;
                        let isUnique = false;
                        while (!isUnique) {
                            // Fetch all results in batches of 1000 to check for duplicates
                            let found = false;
                            let start = 0;
                            const pageSize = 1000;
                            do {
                                const existing = search.create({
                                    type: "customsale_srp_3_pl_salesorder",
                                    filters: [["tranid", "is", tranid]],
                                    columns: ["internalid"]
                                }).run().getRange({start, end: start + pageSize});
                                if (existing && existing.length > 0) {
                                    found = true;
                                    tranid = baseTranid + '-' + suffix;
                                    suffix++;
                                    break;
                                }
                                if (!existing || existing.length < pageSize) {
                                    break;
                                }
                                start += pageSize;
                            } while (true);

                            if (!found) {
                                isUnique = true;
                            }
                        }
                        createRecord.setValue({fieldId: 'tranid', value: tranid});
                    }
                }
                // --- End set tranid ---

                const lineCount = currentRecord.getLineCount({sublistId: 'item'});
                for (let i = 0; i < lineCount; i++) {
                    createRecord.selectNewLine({sublistId: 'item'});

                    const item = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                    const quantity = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i});
                    let rate = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'rate', line: i}) || 1;
                    let amount = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        line: i
                    }) || rate * quantity;


                    if (!item || !quantity) {
                        log.error('Invalid Release Order Line', {item, quantity, line: i});
                        continue;
                    }

                    createRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'item', value: item});
                    createRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'quantity', value: quantity});
                    createRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'rate', value: rate});
                    createRecord.setCurrentSublistValue({sublistId: 'item', fieldId: 'amount', value: amount});

                    // Copy inventory detail if present
                    let currentSubrecord = null;
                    try {
                        currentSubrecord = currentRecord.getSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                            line: i
                        });
                    } catch (e) {
                        log.debug('No inventorydetail subrecord for release order line', {line: i, error: e.message});
                    }

                    if (currentSubrecord) {
                        const inventorySubrecord = createRecord.getCurrentSublistSubrecord({
                            sublistId: 'item',
                            fieldId: 'inventorydetail',
                        });

                        const inventoryDetailLineCount = currentSubrecord.getLineCount({sublistId: 'inventoryassignment'});
                        for (let count = 0; count < inventoryDetailLineCount; count++) {
                            inventorySubrecord.selectNewLine({sublistId: 'inventoryassignment'});

                            const lotno = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                line: count
                            });
                            if (lotno) {
                                inventorySubrecord.setCurrentSublistText({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'issueinventorynumber',
                                    text: lotno
                                });
                            }

                            const binnumber = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: count
                            });
                            if (binnumber) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'binnumber',
                                    value: binnumber
                                });
                            }

                            const invQuantity = currentSubrecord.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                line: count
                            });
                            if (invQuantity) {
                                inventorySubrecord.setCurrentSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    value: invQuantity
                                });
                            }

                            inventorySubrecord.commitLine({sublistId: 'inventoryassignment'});
                        }
                    }

                    createRecord.commitLine({sublistId: 'item'});
                }

                const releaseOrderId = createRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (releaseOrderId) {
                    record.submitFields({
                        type: "custompurchase_srp_r3plo",
                        id: receiveConsignment,
                        values: {custbody_srp_ro: releaseOrderId},
                        options: {enableSourcing: false, ignoreMandatoryFields: true}
                    });
                }

                return releaseOrderId;

            } catch (e) {
                log.error('createReleaseOrder Exception', e);
                return null;
            }
        }

        /**
         * Helper to run a paged search and return all results.
         * @param {search.Search} searchObj
         * @param {number} [pageSize=1000]
         * @returns {Array}
         */
        function getAllResults(searchObj, pageSize = 1000) {
            let results = [], start = 0, batch;
            do {
                batch = searchObj.run().getRange({start, end: start + pageSize});
                if (batch && batch.length > 0) results = results.concat(batch);
                start += pageSize;
            } while (batch && batch.length === pageSize);
            return results;
        }

        /**
         * Helper to batch map bin numbers to 3PL bins.
         * @param {Array} binIds
         * @param {string} default3plBin
         * @returns {Object} binMap
         */
        function getBinMap(binIds, default3plBin) {
            const binMap = {};
            if (!binIds || binIds.length === 0) return binMap;
            const binSearchObj = search.create({
                type: "bin",
                filters: [["internalid", "anyof", binIds]],
                columns: [
                    search.createColumn({name: "internalid"}),
                    search.createColumn({name: "internalid", join: "CUSTRECORD593"})
                ]
            });
            const results = getAllResults(binSearchObj);
            for (const binResult of results) {
                const origBinId = binResult.getValue({name: "internalid"});
                const mappedBinId = binResult.getValue({name: "internalid", join: "CUSTRECORD593"});
                if (origBinId) {
                    binMap[origBinId] = mappedBinId || default3plBin;
                }
            }
            return binMap;
        }

        /**
         * Helper to batch fetch SO item rates/amounts.
         * @param {string|number} soId
         * @param {Array} itemIds
         * @returns {Object} soRates
         */
        function getSoRates(soId, itemIds) {
            const soRates = {};
            if (!soId || !itemIds || itemIds.length === 0) return soRates;
            const salesorderSearchObj = search.create({
                type: record.Type.SALES_ORDER,
                filters: [
                    ["internalid", "anyof", soId],
                    "AND",
                    ["item", "anyof", itemIds]
                ],
                columns: ["item", "amount", "rate"]
            });
            const results = getAllResults(salesorderSearchObj);
            for (const result of results) {
                const itemId = result.getValue({name: "item"});
                soRates[itemId] = {
                    rate: result.getValue({name: "rate"}) || 1,
                    amount: result.getValue({name: "amount"}) || 1
                };
            }
            return soRates;
        }

        return {onRequest};
    });