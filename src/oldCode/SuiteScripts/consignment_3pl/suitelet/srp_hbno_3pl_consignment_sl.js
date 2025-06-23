/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/log', 'N/record', 'N/search', 'N/url', "N/redirect"], (log, record, search, url, redirect) => {
    const onRequest = (context) => {
        try {
            const {request, response} = context;
            const {parameters, method} = request;
            log.debug('suitelet');
            if (method === 'GET') {


                const paramData = parameters.recordId;
                log.debug('Received Data', paramData);

                const consignmentId = createConsignment(paramData);
                log.debug('consignment id', consignmentId);
                if (consignmentId) {
                    const reciveConsignment = createReciveConsignment(consignmentId);
                    log.debug('recive consignment', reciveConsignment);

                    createinventoryadjustment(reciveConsignment);

                    const releaseOrder = createReleaseOrder(reciveConsignment);
                    log.debug('release order id', releaseOrder);

                    const responseBody = {
                        success: true,
                        releaseOrderId: releaseOrder
                    };

                    response.write(JSON.stringify(responseBody));
                }
            } else {
                response.write(JSON.stringify({success: false, message: 'Only GET method is supported'}));
            }
        } catch (error) {
            log.error('Error in Suitelet', error.message);
            response.write(JSON.stringify({success: false, error: error.message}));
        }
    };

    function createConsignment(paramData) {

        try {
            let currentRecord = record.load({
                type: 'itemfulfillment',
                id: paramData,
            });

            let consignmentRecord = record.create({
                type: "custompurchase_srp_3pl_purchase_order",
                isDynamic: true,
            });


            consignmentRecord.setValue({fieldId: 'entity', value: currentRecord.getValue({fieldId: 'entity'})});
            log.debug('entity value', currentRecord.getValue({fieldId: 'entity'}));

            consignmentRecord.setValue({fieldId: 'subsidiary', value: 4});


            let createdfrom = currentRecord.getValue({
                fieldId: 'createdfrom'
            });
            log.debug('createdfrom value', createdfrom);


            consignmentRecord.setValue({fieldId: 'location', value: 40});
            consignmentRecord.setValue({fieldId: 'custbody_srp_createdfromsample_so', value: createdfrom});
            consignmentRecord.setValue({fieldId: 'custbody_created_form', value: paramData});

            consignmentRecord.setValue({fieldId: 'trandate', value: currentRecord.getValue({fieldId: 'trandate'})});
            log.debug('trandate value', currentRecord.getValue({fieldId: 'trandate'}));
            consignmentRecord.setValue({fieldId: 'transtatus', value: 'B'});

            const lineCount = currentRecord.getLineCount({sublistId: 'item'});
            log.debug('lines', lineCount);

            for (let i = 0; i < lineCount; i++) {

                // consignmentRecord.insertLine({
                //     sublistId: 'item',
                //     line: i,
                //    });

                consignmentRecord.selectNewLine({
                    sublistId: 'item'
                });

                const item = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i,
                });
                log.debug('item value', item);


                consignmentRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: item,
                    ignoreFieldChange: false,
                    forceSyncSourcing: true
                });
                const quantity = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
                log.debug('quantity value', quantity);

                consignmentRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: quantity,
                    ignoreFieldChange: false,
                    forceSyncSourcing: true
                });
                let rate = 1;
                let amount = 1;
                let salesorderSearchObj = search.create({
                    type: "salesorder",
                    settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                    filters:
                        [
                            ["type", "anyof", "SalesOrd"],
                            "AND",
                            ["internalid", "anyof", createdfrom],
                            "AND",
                            ["item", "anyof", item]
                        ],
                    columns:
                        [
                            "amount",
                            "rate"
                        ]
                });
                let searchResult = salesorderSearchObj.run().getRange({
                    start: 0,
                    end: 1000
                });
                log.debug('save search length', searchResult.length);
                if (searchResult.length > 0) {
                    rate = searchResult[0].getValue({
                        name: "rate"
                    });
                    log.debug('rate Value', rate);

                    amount = searchResult[0].getValue({
                        name: "amount"
                    });
                    log.debug('amount Value', amount);
                }


                if (rate) {
                    consignmentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: rate,
                    });
                }


                if (amount) {
                    consignmentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: amount,
                    });
                }

                log.debug('line set');

                const currentSubrecord = currentRecord.getSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });
                log.debug('fulfillment subrecord', currentSubrecord);

                if (currentSubrecord) {
                    const inventorySubrecord = consignmentRecord.getCurrentSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                    });
                    log.debug('consignment subrecord', inventorySubrecord)

                    let inventoryDeialLineCount = currentSubrecord.getLineCount({
                        sublistId: 'inventoryassignment'
                    });
                    log.debug('inventory line count', inventoryDeialLineCount);
                    // Add Inventory Details for the current line item using Subrecord


                    for (let count = 0; count < inventoryDeialLineCount; count++) {

                        // Set inventory detail fields (e.g., Location and Quantity)
                        // inventorySubrecord.insertLine({
                        //     sublistId: 'inventoryassignment',
                        //     line: count,
                        //    });

                        inventorySubrecord.selectNewLine({
                            sublistId: 'inventoryassignment'
                        });

                        let lotno = currentSubrecord.getSublistText({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: count
                        });
                        log.debug('lotno text', lotno);
                        if (lotno) {
                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'receiptinventorynumber',
                                line: count, // First inventory assignment
                                value: lotno
                            });
                            log.debug('lotset', lotno);

                        }

                        lotno = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            line: count
                        });
                        log.debug('lotno value', lotno);
                        if (lotno) {
                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: count, // First inventory assignment
                                value: lotno
                            });
                            log.debug('lotset', lotno);

                        }


                        let binnumber = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'binnumber',
                            line: count
                        });
                        log.debug('binnumber value', binnumber);
                        if (binnumber) {

                            binnumber = bin3pl(binnumber);

                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: count, // First inventory assignment
                                value: binnumber
                            });
                            log.debug('binnumber set', binnumber);
                        }

                        let quantity = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            line: count
                        });
                        log.debug('quantity value', quantity);
                        if (quantity) {
                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                line: count, // First inventory assignment
                                value: quantity
                            });
                            log.debug('quantity set', quantity);
                        }


                        // Commit the inventory subrecord
                        inventorySubrecord.commitLine({sublistId: 'inventoryassignment'});

                        log.debug('after inventory commit');
                    }
                }

                consignmentRecord.commitLine({sublistId: 'item'});
                log.debug('after line commit');

            }

            let consignmentRecordId = consignmentRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            log.debug('consgnment created id', consignmentRecordId);

            record.submitFields({
                type: "itemfulfillment",
                id: paramData,
                values: {
                    'custbody_created_form': consignmentRecordId
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });
            return consignmentRecordId;

        } catch (e) {
            log.debug('execption', e);
        }

    }

    function createReciveConsignment(consignmentId) {

        let newRecord = record.transform({
            fromType: "custompurchase_srp_3pl_purchase_order",
            fromId: consignmentId,
            toType: "custompurchase_srp_r3plo",
            isDynamic: true,
        });

        newRecord.setValue({
            fieldId: "custbodycustbody158",
            value: consignmentId,
        });


        let reciveconsignmentId = newRecord.save({
            enableSourcing: true,
            ignoreMandatoryFields: true
        });
        return reciveconsignmentId;
    }

    function createinventoryadjustment(reciveConsignment) {

        try {

            let currentRecord = record.load({
                type: 'custompurchase_srp_r3plo',
                id: reciveConsignment
            });
            let purchaseOrderId = currentRecord.getValue("createdfrom");
            log.debug('po record', purchaseOrderId);

            let inventoryadjustmentSearchObj = search.create({
                type: "inventoryadjustment",
                settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                filters:
                    [
                        ["type", "anyof", "InvAdjst"],
                        "AND",
                        ["custbody_srp3plpurchaseorder", "anyof", purchaseOrderId]
                    ],
                columns:
                    [
                        "internalid",
                        "tranid",
                        "datecreated",
                        "type"
                    ]
            });
            let searchResult = inventoryadjustmentSearchObj.run().getRange({
                start: 0,
                end: 1000
            });
            log.debug('save search length', searchResult.length);
            if (searchResult.length === 0) {

                let inventoryAdjustmentRecord = record.create({
                    type: "inventoryadjustment",
                    isDynamic: true,
                });

                inventoryAdjustmentRecord.setValue({
                    fieldId: "subsidiary",
                    value: currentRecord.getValue("subsidiary"),
                });

                // inventoryAdjustmentRecord.setValue({
                //     fieldId: "customer",
                //     value: currentRecord.getValue("entity"),
                // });

                inventoryAdjustmentRecord.setValue({
                    fieldId: "custbody_srp3plpurchaseorder",
                    value: purchaseOrderId,
                });
                inventoryAdjustmentRecord.setValue({
                    fieldId: 'account',
                    value: 575
                });

                let lineCount = currentRecord.getLineCount({sublistId: "item"});
                log.debug("line count", lineCount);
                // let iter = 0; // Manage iteration manually
                // let location = currentRecord.getValue({
                //     fieldId: "location",
                // });
                // log.debug("location value", location);

                for (let i = 0; i < lineCount; i++) {
                    // Fetch required values from the purchase order's item sublist
                    let item = currentRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        line: i,
                    });
                    log.debug("item", item);
                    let quantity = currentRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        line: i,
                    });
                    //    quantity = quantity > 0 ? quantity * -1 : quantity;
                    log.debug("quantity", quantity);
                    let location = currentRecord.getSublistValue({sublistId: 'item', fieldId: 'location', line: i});
                    log.debug('location', location);

                    //let location = '39';
                    // Only add the item if it exists

                    inventoryAdjustmentRecord.selectNewLine({sublistId: "inventory"});


                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "item",
                        value: item,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true
                    });
                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "adjustqtyby",
                        value: quantity,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true
                    });
                    // inventoryAdjustmentRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'rate', value: rate });
                    inventoryAdjustmentRecord.setCurrentSublistValue({
                        sublistId: "inventory",
                        fieldId: "location",
                        value: location,
                        ignoreFieldChange: false,
                        forceSyncSourcing: true
                    });

                    // Handle inventory detail subrecord if exists
                    let inventoryDetailSubrecord = currentRecord.getSublistSubrecord({
                        sublistId: "item",
                        fieldId: "inventorydetail",
                        line: i,
                    });
                    log.debug("fulfill inventory detial", inventoryDetailSubrecord);

                    if (inventoryDetailSubrecord) {
                        let inventoryDetailLineCount = inventoryDetailSubrecord.getLineCount({
                            sublistId: "inventoryassignment",
                        });
                        log.debug("fullfill inventory lincount", inventoryDetailLineCount);

                        let adjustInventoryDetailSubrecord = inventoryAdjustmentRecord.getCurrentSublistSubrecord({
                            sublistId: "inventory",
                            fieldId: "inventorydetail",
                        });
                        log.debug("adjust inventory detial", adjustInventoryDetailSubrecord);

                        for (let j = 0; j < inventoryDetailLineCount; j++) {

                            let receiptinventorynumber = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "receiptinventorynumber",
                                line: j,
                            });
                            log.debug("lot number", receiptinventorynumber);

                            let binNumber = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "binnumber",
                                line: j,
                            });
                            log.debug("binNumber", binNumber);

                            let inventoryQuantity = inventoryDetailSubrecord.getSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "quantity",
                                line: j,
                            });
                            // inventoryQuantity = inventoryQuantity > 0 ? inventoryQuantity * -1 : inventoryQuantity;
                            log.debug("inventoryQuantity", inventoryQuantity);
                            // Set inventory detail values issueinventorynumber receiptinventorynumber
                            adjustInventoryDetailSubrecord.selectNewLine({
                                sublistId: "inventoryassignment",
                            });
                            log.debug('line select');

                            adjustInventoryDetailSubrecord.setCurrentSublistText({
                                sublistId: "inventoryassignment",
                                fieldId: "receiptinventorynumber",
                                text: receiptinventorynumber,
                                ignoreFieldChange: false,
                                forceSyncSourcing: true
                            });
                            log.debug('set lot number');

                            adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "binnumber",
                                value: binNumber,
                            });
                            log.debug('set binNumber');

                            adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                sublistId: "inventoryassignment",
                                fieldId: "quantity",
                                value: inventoryQuantity,
                            });
                            log.debug('set inventoryQuantity');

                            adjustInventoryDetailSubrecord.commitLine({
                                sublistId: "inventoryassignment",
                            });
                            log.debug("after inventory detail line commit");
                        }
                    }

                    //  iter++; // Increment the iter letiable only after processing valid lines
                    inventoryAdjustmentRecord.commitLine({sublistId: "inventory"});
                }
                log.debug("after item line commit");

                let adjustmentReocrdId = inventoryAdjustmentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true,
                });
                log.debug("adjustment record id", adjustmentReocrdId);
                if (adjustmentReocrdId) {
                    let fulfillmentrecord = record.submitFields({
                        type: "custompurchase_srp_r3plo",
                        id: reciveConsignment,
                        values: {
                            custbody_srp_linked_inventory_adj: adjustmentReocrdId
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                }
            }


        } catch (e) {
            log.debug("execption", e);
        }
    }

    function createReleaseOrder(reciveConsignment) {

        try {
            let currentRecord = record.load({
                type: 'custompurchase_srp_r3plo',
                id: reciveConsignment,
            });

            let createRecord = record.create({
                type: "customsale_srp_3_pl_salesorder",
                isDynamic: true,
            });

            createRecord.setValue({fieldId: 'customform', value: 249});
            createRecord.setValue({fieldId: 'entity', value: currentRecord.getValue({fieldId: 'entity'})});
            log.debug('entity value', currentRecord.getValue({fieldId: 'entity'}));

            createRecord.setValue({fieldId: 'subsidiary', value: currentRecord.getValue({fieldId: 'subsidiary'})});
            log.debug('subsidiary value', currentRecord.getValue({fieldId: 'subsidiary'}));
            createRecord.setValue({fieldId: 'transtatus', value: 'E'});

            createRecord.setValue({
                fieldId: 'custbody_srp_createdfromsample_so',
                value: currentRecord.getValue({fieldId: 'custbody_srp_createdfromsample_so'})
            });
            let createdfrom = currentRecord.getValue({
                fieldId: 'createdfrom'
            });
            log.debug('createdfrom value', createdfrom);

            createRecord.setValue({fieldId: 'custbody_created_form', value: reciveConsignment});


            let createdfromRecord = search.lookupFields({
                type: "custompurchase_srp_3pl_purchase_order",
                id: createdfrom,
                columns: ['location']
            });


            log.debug('location value', createdfromRecord.location[0].value);
            if (createdfromRecord.location) {
                createRecord.setValue({fieldId: 'location', value: createdfromRecord.location[0].value});
            }


            const lineCount = currentRecord.getLineCount({sublistId: 'item'});
            log.debug('lines', lineCount);

            for (let i = 0; i < lineCount; i++) {

                createRecord.selectNewLine({
                    sublistId: 'item'
                });

                const item = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i,
                });
                log.debug('item value', item);


                createRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    value: item,
                    ignoreFieldChange: false,
                    forceSyncSourcing: true
                });
                const quantity = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
                log.debug('quantity value', quantity);

                createRecord.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    value: quantity,
                    ignoreFieldChange: false,
                    forceSyncSourcing: true
                });
                let rate = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: i
                });
                log.debug('rate value', rate);
                rate = rate || 1;
                if (rate) {
                    createRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: rate,
                    });
                }

                let amount = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'amount',
                    line: i
                });
                log.debug('amount value', amount);
                amount = amount || rate * quantity;
                if (amount) {
                    createRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'amount',
                        value: amount,
                    });
                }

                log.debug('line set');

                const currentSubrecord = currentRecord.getSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail',
                    line: i
                });
                log.debug('fulfillment subrecord', currentSubrecord);

                if (currentSubrecord) {
                    const inventorySubrecord = createRecord.getCurrentSublistSubrecord({
                        sublistId: 'item',
                        fieldId: 'inventorydetail',
                    });
                    log.debug('consignment subrecord', inventorySubrecord)

                    let inventoryDeialLineCount = currentSubrecord.getLineCount({
                        sublistId: 'inventoryassignment'
                    });
                    log.debug('inventory line count', inventoryDeialLineCount);
                    // Add Inventory Details for the current line item using Subrecord


                    for (let count = 0; count < inventoryDeialLineCount; count++) {

                        // Set inventory detail fields (e.g., Location and Quantity)
                        // inventorySubrecord.insertLine({
                        //     sublistId: 'inventoryassignment',
                        //     line: count,
                        //    });
                        inventorySubrecord.selectNewLine({
                            sublistId: 'inventoryassignment'
                        });

                        let lotno = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            line: count
                        });
                        log.debug('lotno value', lotno);
                        if (lotno) {
                            inventorySubrecord.setCurrentSublistText({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: count, // First inventory assignment
                                text: lotno
                            });
                            log.debug('lotset', lotno);

                        }


                        let binnumber = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'binnumber',
                            line: count
                        });
                        log.debug('binnumber value', binnumber);
                        if (binnumber) {
                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: count, // First inventory assignment
                                value: binnumber
                            });
                            log.debug('binnumber set', binnumber);
                        }

                        let quantity = currentSubrecord.getSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            line: count
                        });
                        log.debug('quantity value', quantity);
                        if (quantity) {
                            inventorySubrecord.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                line: count, // First inventory assignment
                                value: quantity
                            });
                            log.debug('quantity set', quantity);
                        }


                        // Commit the inventory subrecord
                        inventorySubrecord.commitLine({sublistId: 'inventoryassignment'});

                        log.debug('after inventory commit');
                    }
                }

                createRecord.commitLine({sublistId: 'item'});
                log.debug('after line commit');

            }

            let consignmentRecordId = createRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            log.debug('consgnment created id', consignmentRecordId);
            if (consignmentRecordId) {
                record.submitFields({
                    type: "custompurchase_srp_r3plo",
                    id: reciveConsignment,
                    values: {
                        custbody_srp_ro: consignmentRecordId
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
            if (consignmentRecordId) {

                let salesorderRecord = search.lookupFields({
                    type: "salesorder",
                    id: currentRecord.getValue({fieldId: 'custbody_srp_createdfromsample_so'}),
                    columns: ['tranid']
                });
                log.debug('tranid', salesorderRecord.tranid);
                if (salesorderRecord.tranid) {


                    record.submitFields({
                        type: "customsale_srp_3_pl_salesorder",
                        id: consignmentRecordId,
                        values: {
                            tranid: salesorderRecord.tranid + '-3PL'
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });

                }


            }
            return consignmentRecordId;

        } catch (e) {
            log.debug('execption', e);
        }
    }

    function bin3pl(binNumber) {

        let binSearchObj = search.create({
            type: "bin",
            filters:
                [
                    ["internalid", "anyof", binNumber]
                ],
            columns:
                [
                    search.createColumn({
                        name: "internalid",
                        join: "CUSTRECORD593"
                    })
                ]
        });
        let searchbin = binSearchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('save search length', searchbin.length);
        let binValue3pl = 5926;
        if (searchbin.length > 0) {
            binValue3pl = searchbin[0].getValue({
                name: "internalid",
                join: "CUSTRECORD593"
            });
            log.debug('binValue3pl Value', binValue3pl);
        }
        binValue3pl = binValue3pl || 5926;

        return binValue3pl;
    }

    return {onRequest};
});
