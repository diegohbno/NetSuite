/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    /**
     * Loads the sales order search and returns results.
     * @returns {Search} The loaded sales order search.
     */
    const getInputData = () => {
        try {
            log.debug('getInputData', 'Loading sales order from saved search');

            return search.load({id: 'customsearch4811'});
            //return search.load({id: 'customsearch4800'});
        } catch (e) {
            log.error('Error in getInputData', e);
        }
    };

    /**
     * For each sales order:
     * 1. Finds all customsale_srp_f3plo records with custbody_srp_createdfromsample_so = sales order id.
     * 2. Sums quantity per item from customsale_srp_f3plo.
     * 3. Compares with sales order item and quantity, logs differences.
     *
     * @param {ReduceContext} context - The reduce context.
     */
    const reduce = (context) => {
        try {
            log.debug('reduce', `Context: ${JSON.stringify(context)}`);
            const resultObj = JSON.parse(context.values[0]);
            const salesOrderId = resultObj.values["GROUP(internalid.CUSTBODY_SRP_CREATEDFROMSAMPLE_SO)"].value;
            log.debug('Processing resultObj', resultObj);
            log.debug('Processing Sales Order', salesOrderId);

            // Load the sales order
            log.debug('Loading sales order record', {salesOrderId});
            const soRec = record.load({
                type: 'salesorder',
                id: salesOrderId,
                isDynamic: false
            });

            // Build a map of itemId => quantity from the sales order
            const soLineCount = soRec.getLineCount({sublistId: 'item'});
            log.debug('Sales Order line count', soLineCount);
            const soItemQtyMap = {};
            for (let i = 0; i < soLineCount; i++) {
                const itemId = soRec.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                const qty = Number(soRec.getSublistValue({sublistId: 'item', fieldId: 'quantity', line: i})) || 0;
                log.debug(`SO Line ${i}: itemId=${itemId}, qty=${qty}`);
                soItemQtyMap[itemId] = qty;
            }
            log.debug('Sales Order Item/Qty Map', JSON.stringify(soItemQtyMap));

            // Search all customsale_srp_f3plo records linked to this sales order
            log.debug('Searching customsale_srp_f3plo records', {salesOrderId});
            const f3ploSearch = search.create({
                type: 'customsale_srp_f3plo',
                filters: [
                    ['custbody_srp_createdfromsample_so', 'anyof', salesOrderId]
                ],
                columns: [
                    'internalid',
                    'item',
                    'quantity'
                ]
            });

            // Sum quantity per item from customsale_srp_f3plo and track highest quantity record per item
            const f3ploItemQtyMap = {};
            const f3ploHighestQtyMap = {};
            let f3ploCount = 0;
            const f3ploIds = [];
            f3ploSearch.run().each(result => {
                f3ploCount++;
                const itemId = result.getValue({name: 'item'});
                const qty = Number(result.getValue({name: 'quantity'})) || 0;
                const internalId = result.getValue({name: 'internalid'});

                log.debug(`F3PLO Result ${f3ploCount}: internalId=${internalId}, itemId=${itemId}, qty=${qty}`);

                f3ploItemQtyMap[itemId] = (f3ploItemQtyMap[itemId] || 0) + qty;

                if (!f3ploHighestQtyMap[itemId] || qty > f3ploHighestQtyMap[itemId].quantity) {
                    f3ploHighestQtyMap[itemId] = {internalId, quantity: qty};
                    log.debug(`New highest F3PLO for item ${itemId}: internalId=${internalId}, qty=${qty}`);
                }
                f3ploIds.push(internalId);
                return true;
            });
            log.debug('F3PLO Item/Qty Map', JSON.stringify(f3ploItemQtyMap));
            log.debug('F3PLO Highest Qty Map', JSON.stringify(f3ploHighestQtyMap));
            log.debug('Total F3PLO records found', f3ploCount);

            // Compare and log differences, and adjust inventory detail if needed
            Object.keys(soItemQtyMap).forEach(itemId => {
                const soQty = soItemQtyMap[itemId] || 0;
                const f3ploQty = f3ploItemQtyMap[itemId] || 0;
                const diff = f3ploQty - soQty;
                log.debug(`Item ${itemId} - SO Qty: ${soQty}, F3PLO Qty: ${f3ploQty}, Difference: ${diff}`);

                // --- NEW: Search for item fulfillments for this SO, custbody_created_form empty, group by tranid and get max qty ---
                let fulfillmentQtyMap = {};
                try {
                    var itemfulfillmentSearchObj = search.create({
                        type: "itemfulfillment",
                        settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                        filters: [
                            ["createdfrom", "anyof", salesOrderId],
                            "AND",
                            ["type", "anyof", "ItemShip"],
                            "AND",
                            ["mainline", "is", "F"],
                            "AND",
                            ["shipping", "is", "F"],
                            "AND",
                            ["taxline", "is", "F"],
                            "AND",
                            ["custbody_created_form", "anyof", "@NONE@"]
                        ],
                        columns: [
                            search.createColumn({
                                name: "quantity",
                                summary: "MAX",
                                label: "Quantity"
                            }),
                            search.createColumn({
                                name: "item",
                                summary: "GROUP",
                                label: "Item"
                            }),
                            search.createColumn({
                                name: "tranid",
                                summary: "GROUP",
                                label: "Document Number"
                            })
                        ]
                    });
                    var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
                    log.debug("itemfulfillmentSearchObj result count", searchResultCount);
                    itemfulfillmentSearchObj.run().each(function (result) {
                        const itemId = result.getValue({name: 'item', summary: 'GROUP'});
                        const maxQty = Number(result.getValue({name: 'quantity', summary: 'MAX'})) || 0;
                        if (!(fulfillmentQtyMap[itemId])) fulfillmentQtyMap[itemId] = 0;
                        fulfillmentQtyMap[itemId] += +maxQty;
                        log.debug(`Fulfillment Document ${itemId}: max qty=${maxQty}`);
                        return true;
                    });
                } catch (e) {
                    log.error('Error searching item fulfillments', e);
                }
                // --- END NEW ---
                log.debug('fulfillmentQtyMap', fulfillmentQtyMap)
                log.debug('itemId', itemId)
                // If there is a fulfillment qty for this item, subtract it from diff before updating F3PLO
                let adjustedDiff = diff;
                if (fulfillmentQtyMap[itemId]) {
                    log.debug(`Subtracting fulfillment qty (${fulfillmentQtyMap[itemId]}) from diff for item ${itemId}`);
                    adjustedDiff += fulfillmentQtyMap[itemId];
                }

                log.debug(`Adjusting inventory detail for item ${itemId}, adjusted diff: ${adjustedDiff}`);
                // Load the customsale_srp_f3plo record with the highest quantity for this item
                const f3ploRec = record.load({
                    type: 'customsale_srp_f3plo',
                    id: f3ploHighestQtyMap[itemId].internalId,
                    isDynamic: false
                });

                // Find the line in the item sublist that matches the item
                const lineCount = f3ploRec.getLineCount({sublistId: 'item'});
                log.debug(`F3PLO record line count: ${lineCount}`);
                for (let i = 0; i < lineCount; i++) {
                    const lineItemId = f3ploRec.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                    log.debug(`F3PLO record line ${i}: itemId=${lineItemId}`);
                    if (Number(lineItemId) === Number(itemId)) {
                        // Set the new quantity on the item line before adjusting inventory detail
                        try {
                            const origLineQty = Number(f3ploRec.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: i
                            })) || 0;
                            const newLineQty = origLineQty - adjustedDiff;
                            log.debug(`Setting item line quantity for line ${i}: original qty=${origLineQty}, new qty=${newLineQty}`);
                            f3ploRec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: i,
                                value: newLineQty
                            });

                            log.debug(`Loading inventorydetail subrecord for line ${i}`);
                            const inventoryDetail = f3ploRec.getSublistSubrecord({
                                sublistId: 'item',
                                fieldId: 'inventorydetail',
                                line: i
                            });
                            const invAssignCount = inventoryDetail.getLineCount({sublistId: 'inventoryassignment'});
                            log.debug(`inventoryassignment line count: ${invAssignCount}`);
                            for (let j = 0; j < invAssignCount; j++) {
                                const origQty = Number(inventoryDetail.getSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    line: j
                                })) || 0;
                                const newQty = origQty - adjustedDiff;
                                log.debug(`Adjusting inventoryassignment line ${j}: original qty=${origQty}, new qty=${newQty}`);
                                inventoryDetail.setSublistValue({
                                    sublistId: 'inventoryassignment',
                                    fieldId: 'quantity',
                                    line: j,
                                    value: newQty
                                });
                            }
                            f3ploRec.save();
                            log.audit('Adjusted F3PLO inventory detail and item quantity', `Record: ${f3ploHighestQtyMap[itemId].internalId}, Item: ${itemId}, Adjusted Diff: ${adjustedDiff}`);
                        } catch (e) {
                            log.error('Error adjusting inventory detail or item quantity', `Record: ${f3ploHighestQtyMap[itemId].internalId}, Item: ${itemId}, Error: ${e.message}`);
                        }
                        break;
                    }

                }
            });

            // After editing the sales order, load and save all associated customsale_srp_f3plo records and log their IDs
            const uniqueF3ploIds = [...new Set(f3ploIds)];
            log.debug('Loading and saving all associated customsale_srp_f3plo records (unique)', uniqueF3ploIds);
            uniqueF3ploIds.forEach(f3ploId => {
                try {
                    if (f3ploId == 1057762) {
                        const rec = record.load({
                            type: 'customsale_srp_f3plo',
                            id: f3ploId,
                            isDynamic: false
                        });
                        rec.save();
                        log.audit('Saved customsale_srp_f3plo record', `ID: ${f3ploId}`);
                    }
                } catch (e) {
                    log.error('Error saving customsale_srp_f3plo record', `ID: ${f3ploId}, Error: ${e.message}`);
                }
            });

        } catch (e) {
            log.error('Error in reduce', e);
        }
    };

    /**
     * Moves all inventory assignments to the bin of the first line.
     *
     * @param {Record} rec - The record (Consignment Receipt or Inventory Adjustment).
     */
    function updateInventoryDetails(rec) {
        log.debug('updateInventoryDetails', `Processing record ID: ${rec.id}, Type: ${rec.type}`);
        var sublistId = rec.type === 'inventoryadjustment' ? 'inventory' : 'item';
        const lineCount = rec.getLineCount({sublistId: sublistId});

        log.debug('Line count', lineCount);
        if (lineCount === 0) {
            log.warning('No inventory lines found', `Record ID: ${rec.id}`);
            return;
        }

        const bin = getFirstBin(rec, 0, sublistId);
        log.debug('bin', bin);

        if (!bin) {
            log.warning('Could not determine bin from first inventory line', `Record ID: ${rec.id}`);
            return;
        }

        log.debug('Reassigning bins', `Target bin: ${bin}, Total lines: ${lineCount}`);

        for (let i = 0; i < lineCount; i++) {
            try {
                const detailSubrecord = rec.getSublistSubrecord({
                    sublistId: sublistId,
                    fieldId: 'inventorydetail',
                    line: i
                });

                const inventoryLineCount = detailSubrecord.getLineCount({sublistId: 'inventoryassignment'});

                for (let j = 0; j < inventoryLineCount; j++) {
                    detailSubrecord.setSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'binnumber',
                        line: j,
                        value: bin
                    });
                }

                log.debug('Bin reassigned for line', `Inventory line: ${i}`);
            } catch (err) {
                log.error('Error updating inventory detail', `Line ${i}: ${err.message}`);
            }
        }
    }

    /**
     * Gets the bin number from the first inventory assignment line.
     *
     * @param {Record} rec - The record from which to extract the bin number.
     * @param {number} lineIndex - The inventory line index to use (usually 0).
     * @returns {number|null} The internal ID of the bin, or null if not found.
     */
    function getFirstBin(rec, lineIndex, sublistId) {
        try {
            const detailSubrecord = rec.getSublistSubrecord({
                sublistId: sublistId,
                fieldId: 'inventorydetail',
                line: lineIndex
            });

            return detailSubrecord.getSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'binnumber',
                line: 0
            });
        } catch (e) {
            log.error('Failed to retrieve first bin', `Line: ${lineIndex}, Error: ${e.message}`);
            return null;
        }
    }

    return {
        getInputData,
        reduce
    };
});
