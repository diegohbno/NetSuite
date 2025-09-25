/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(["N/url", "N/redirect", "N/record", "N/search"], function (url, redirect, record, search) {
    function beforeLoad(context) {
        var currentRecord = context.newRecord;
        var recordType = currentRecord.type;
        if (context.type === context.UserEventType.EDIT && recordType === "customsale_srp_f3plo") {
            try {
                var lineCount = currentRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var r = lineCount - 1; r >= 0; r--) {
                    var quantity3pl = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_3pl_quantity',
                        line: r
                    });
                    log.debug('quantity3pl value', quantity3pl);
                    if (quantity3pl == 0) {
                        log.debug('inside the if');
                        currentRecord.removeLine({
                            sublistId: 'item',
                            line: r,
                            ignoreRecalc: true // Set to true to bypass recalculation after removal, if needed.
                        });
                    }

                }


            } catch (e) {
                log.debug('execption', e);
            }

        }

    }

    function afterSubmit(context) {
        // Ensure this only runs when the record is created or updated
        if (
            context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT
        ) {
            return;
        }

        // Get the current record type and ID
        var recordId = context.newRecord.id;
        var recordType = context.newRecord.type;

        // Resolve the URL to open the record in view mode
        var viewUrl = url.resolveRecord({
            recordType: recordType,
            recordId: recordId,
            isEditMode: false, // Set to false to open in view mode
        });

        // Redirect the user to the view mode of the current record
        redirect.redirect({
            url: viewUrl,
        });
        if (recordType === "custompurchase_srp_r3plo") {
            try {
                var currentRecord = context.newRecord;
                var purchaseOrderId = currentRecord.getValue("custbodycustbody158");
                log.debug('po record', purchaseOrderId);
                var inventoryadjustment = currentRecord.getValue("custbody_srp_linked_inventory_adj");
                if (!inventoryadjustment) {


                    var inventoryadjustmentSearchObj = search.create({
                        type: "inventoryadjustment",
                        settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                        filters:
                            [
                                ["type", "anyof", "InvAdjst"],
                                "AND",
                                ["custbody_srp3plpurchaseorder", "anyof", recordId]
                            ],
                        columns:
                            [
                                "internalid",
                                "tranid",
                                "datecreated",
                                "type"
                            ]
                    });
                    var searchResult = inventoryadjustmentSearchObj.run().getRange({
                        start: 0,
                        end: 1000
                    });
                    log.debug('save search length', searchResult.length);
                    if (searchResult.length === 0) {

                        var inventoryAdjustmentRecord = record.create({
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
                            value: recordId,
                        });
                        inventoryAdjustmentRecord.setValue({
                            fieldId: 'account',
                            value: 575
                        });

                        var lineCount = currentRecord.getLineCount({sublistId: "item"});
                        log.debug("line count", lineCount);
                        // let iter = 0; // Manage iteration manually
                        // var location = currentRecord.getValue({
                        //     fieldId: "location",
                        // });
                        // log.debug("location value", location);

                        for (var i = 0; i < lineCount; i++) {
                            // Fetch required values from the purchase order's item sublist
                            var item = currentRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "item",
                                line: i,
                            });
                            log.debug("item", item);
                            var quantity = currentRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                line: i,
                            });
                            //    quantity = quantity > 0 ? quantity * -1 : quantity;
                            log.debug("quantity", quantity);
                            var location = currentRecord.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'location',
                                line: i
                            });
                            log.debug('location', location);

                            //var location = '39';
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
                            var inventoryDetailSubrecord = currentRecord.getSublistSubrecord({
                                sublistId: "item",
                                fieldId: "inventorydetail",
                                line: i,
                            });
                            log.debug("fulfill inventory detial", inventoryDetailSubrecord);

                            if (inventoryDetailSubrecord) {
                                var inventoryDetailLineCount = inventoryDetailSubrecord.getLineCount({
                                    sublistId: "inventoryassignment",
                                });
                                log.debug("fullfill inventory lincount", inventoryDetailLineCount);

                                var adjustInventoryDetailSubrecord = inventoryAdjustmentRecord.getCurrentSublistSubrecord({
                                    sublistId: "inventory",
                                    fieldId: "inventorydetail",
                                });
                                log.debug("adjust inventory detial", adjustInventoryDetailSubrecord);

                                for (var j = 0; j < inventoryDetailLineCount; j++) {

                                    var receiptinventorynumber = inventoryDetailSubrecord.getSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "receiptinventorynumber",
                                        line: j,
                                    });
                                    log.debug("lot number", receiptinventorynumber);

                                    var binNumber = inventoryDetailSubrecord.getSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "binnumber",
                                        line: j,
                                    });
                                    log.debug("binNumber", binNumber);

                                    var inventoryQuantity = inventoryDetailSubrecord.getSublistValue({
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

                            //  iter++; // Increment the iter variable only after processing valid lines
                            inventoryAdjustmentRecord.commitLine({sublistId: "inventory"});
                        }
                        log.debug("after item line commit");

                        var adjustmentReocrdId = inventoryAdjustmentRecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                        });
                        log.debug("adjustment record id", adjustmentReocrdId);
                        if (adjustmentReocrdId) {
                            var fulfillmentrecord = record.submitFields({
                                type: "custompurchase_srp_r3plo",
                                id: recordId,
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

                }

                var consignmentRecord = record.load({
                    type: 'custompurchase_srp_3pl_purchase_order',
                    id: purchaseOrderId
                });
                var lineCount = currentRecord.getLineCount({
                    sublistId: 'item'
                });
                var lineCountConsignment = consignmentRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < lineCount; i++) {
                    var item = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });
                    log.debug('item value', item);
                    for (var u = 0; u < lineCountConsignment; u++) {
                        var itemConsignment = consignmentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: u
                        });
                        log.debug('itemConsignment value', itemConsignment);
                        if (itemConsignment === item) {
                            consignmentRecord.setSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_srp_3pl_quantity",
                                value: totalQuantity(item, purchaseOrderId),
                                line: u,
                                ignoreFieldChange: true,
                                forceSyncSourcing: true
                            });

                        }
                    }


                }
                consignmentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

            } catch (e) {
                log.debug("execption", e);
            }
        }
        if (recordType === "customsale_srp_f3plo") {
            try {
                var currentRecord = context.newRecord;
                var salesOrderId = currentRecord.getValue("custbodycustbody159");
                var inventoryadjustment = currentRecord.getValue("custbody_srp_linked_inventory_adj");
                if (!inventoryadjustment) {

                    var inventoryadjustmentSearchObj = search.create({
                        type: "inventoryadjustment",
                        settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                        filters:
                            [
                                ["type", "anyof", "InvAdjst"],
                                "AND",
                                ["custbody_srp_3_pl_sales_order", "anyof", recordId]
                            ],
                        columns:
                            [
                                "internalid",
                                "tranid",
                                "datecreated",
                                "type"
                            ]
                    });
                    var searchResult = inventoryadjustmentSearchObj.run().getRange({
                        start: 0,
                        end: 1000
                    });
                    log.debug('save search length', searchResult.length);
                    if (searchResult.length === 0) {

                        var inventoryAdjustmentRecord = record.create({
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
                            fieldId: "custbody_srp_3_pl_sales_order",
                            value: recordId,
                        });
                        inventoryAdjustmentRecord.setValue({
                            fieldId: 'account',
                            value: 575
                        });

                        var lineCount = currentRecord.getLineCount({sublistId: "item"});
                        log.debug("line count", lineCount);
                        // let iter = 0; // Manage iteration manually
                        var location = currentRecord.getValue({
                            fieldId: "location",
                        });
                        log.debug("location value", location);

                        inventoryAdjustmentRecord.setValue({
                            fieldId: "adjlocation",
                            value: location,
                        });

                        for (var i = 0; i < lineCount; i++) {
                            // Fetch required values from the purchase order's item sublist
                            var item = currentRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "item",
                                line: i,
                            });
                            log.debug("item", item);
                            var quantity = currentRecord.getSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                line: i,
                            });
                            quantity = quantity > 0 ? quantity * -1 : quantity;
                            log.debug("quantity", quantity);
                            // var rate = currentRecord.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: i });
                            // log.debug('rate', rate);

                            //var location = '39';
                            // Only add the item if it exists

                            inventoryAdjustmentRecord.selectNewLine({sublistId: "inventory"});

                            inventoryAdjustmentRecord.setCurrentSublistValue({
                                sublistId: "inventory",
                                fieldId: "item",
                                value: item,
                            });
                            inventoryAdjustmentRecord.setCurrentSublistValue({
                                sublistId: "inventory",
                                fieldId: "adjustqtyby",
                                value: quantity,
                            });
                            // inventoryAdjustmentRecord.setCurrentSublistValue({ sublistId: 'inventory', fieldId: 'rate', value: rate });
                            inventoryAdjustmentRecord.setCurrentSublistValue({
                                sublistId: "inventory",
                                fieldId: "location",
                                value: location,
                            });

                            // Handle inventory detail subrecord if exists
                            var inventoryDetailSubrecord = currentRecord.getSublistSubrecord({
                                sublistId: "item",
                                fieldId: "inventorydetail",
                                line: i,
                            });
                            log.debug("fulfill inventory detial", inventoryDetailSubrecord);

                            if (inventoryDetailSubrecord) {
                                var inventoryDetailLineCount = inventoryDetailSubrecord.getLineCount({
                                    sublistId: "inventoryassignment",
                                });
                                log.debug("fullfill inventory lincount", inventoryDetailLineCount);

                                var adjustInventoryDetailSubrecord = inventoryAdjustmentRecord.getCurrentSublistSubrecord({
                                    sublistId: "inventory",
                                    fieldId: "inventorydetail",
                                });
                                log.debug(
                                    "adjust inventory detial",
                                    adjustInventoryDetailSubrecord
                                );

                                for (var j = 0; j < inventoryDetailLineCount; j++) {

                                    var receiptinventorynumber = inventoryDetailSubrecord.getSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "issueinventorynumber",
                                        line: j,
                                    });
                                    log.debug("lot number", receiptinventorynumber);

                                    var binNumber = inventoryDetailSubrecord.getSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "binnumber",
                                        line: j,
                                    });
                                    log.debug("binNumber", binNumber);

                                    var inventoryQuantity = inventoryDetailSubrecord.getSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "quantity",
                                        line: j,
                                    });
                                    inventoryQuantity = inventoryQuantity > 0 ? inventoryQuantity * -1 : inventoryQuantity;
                                    log.debug("inventoryQuantity", inventoryQuantity);
                                    // Set inventory detail values issueinventorynumber receiptinventorynumber
                                    adjustInventoryDetailSubrecord.selectNewLine({
                                        sublistId: "inventoryassignment",
                                    });

                                    adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "issueinventorynumber",
                                        value: receiptinventorynumber,
                                        ignoreFieldChange: false,
                                        forceSyncSourcing: true,
                                    });
                                    adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "binnumber",
                                        value: parseInt(binNumber),
                                    });
                                    adjustInventoryDetailSubrecord.setCurrentSublistValue({
                                        sublistId: "inventoryassignment",
                                        fieldId: "quantity",
                                        value: inventoryQuantity,
                                    });
                                    adjustInventoryDetailSubrecord.commitLine({
                                        sublistId: "inventoryassignment",
                                    });
                                    log.debug("after inventory detail line commit");
                                }
                            }

                            //  iter++; // Increment the iter variable only after processing valid lines
                            inventoryAdjustmentRecord.commitLine({sublistId: "inventory"});
                        }
                        log.debug("after item line commit");

                        var adjustmentReocrdId = inventoryAdjustmentRecord.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true,
                        });
                        log.debug("adjustment record id", adjustmentReocrdId);
                        if (adjustmentReocrdId) {
                            var fulfillmentrecord = record.submitFields({
                                type: "customsale_srp_f3plo",
                                id: recordId,
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

                }//if so id have

                var consignmentRecord = record.load({
                    type: 'customsale_srp_3_pl_salesorder',
                    id: salesOrderId
                });

                var releaseorderQty = parseFloat(releaseOrderTotalQty(salesOrderId));
                log.debug('releaseorderQty', releaseorderQty);
                var shipmentNoteQty = parseFloat(shipmentNoteTotalQty(salesOrderId));
                log.debug('shipmentNoteQty', shipmentNoteQty);
                if (releaseorderQty > shipmentNoteQty) {
                    consignmentRecord.setValue({
                        fieldId: "transtatus",
                        value: "F",
                    });
                } else if (releaseorderQty === shipmentNoteQty) {
                    consignmentRecord.setValue({
                        fieldId: "transtatus",
                        value: "G",
                    });
                }
                var lineCount = currentRecord.getLineCount({
                    sublistId: 'item'
                });
                var lineCountConsignment = consignmentRecord.getLineCount({
                    sublistId: 'item'
                });
                for (var i = 0; i < lineCount; i++) {
                    var item = currentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });
                    log.debug('item value', item);
                    for (var u = 0; u < lineCountConsignment; u++) {
                        var itemConsignment = consignmentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: u
                        });
                        log.debug('itemConsignment value', itemConsignment);
                        if (itemConsignment === item) {
                            var releaseOrderQty = consignmentRecord.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: u
                            });
                            log.debug('itemConsignment value', itemConsignment);

                            consignmentRecord.setSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_srp_3pl_quantity",
                                value: totalQuantityshipmentNote(item, salesOrderId),
                                line: u,
                                ignoreFieldChange: true,
                                forceSyncSourcing: true
                            });
                            consignmentRecord.setSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_srp_3pl_remaining_qty",
                                value: releaseOrderQty - totalQuantityshipmentNote(item, salesOrderId),
                                line: u,
                                ignoreFieldChange: true,
                                forceSyncSourcing: true
                            });

                        }
                    }


                }
                consignmentRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

            } catch (e) {
                log.debug("execption", e);
            }
        }

    }

    function totalQuantity(item, purchaseOrderId) {
        var value = 0;
        var transactionSearchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters:
                [
                    ["type", "anyof", "CuTrPrch101"],
                    "AND",
                    ["item", "anyof", item],
                    "AND",
                    ["custbodycustbody158", "anyof", purchaseOrderId]
                ],
            columns:
                [
                    search.createColumn({
                        name: "item",
                        summary: "GROUP"
                    }),
                    search.createColumn({
                        name: "quantity",
                        summary: "SUM"
                    })
                ]
        });
        var searchResult = transactionSearchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('save search length', searchResult.length);
        if (searchResult.length > 0) {
            var quantity = searchResult[0].getValue({
                name: "quantity",
                summary: "SUM"
            });
            log.debug('quantity Value', quantity);
            value = quantity;
        }

        return value;

    }

    function totalQuantityshipmentNote(item, purchaseOrderId) {
        var value = 0;
        var transactionSearchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters:
                [
                    ["type", "anyof", "CuTrSale102"],
                    "AND",
                    ["item", "anyof", item],
                    "AND",
                    ["custbodycustbody159", "anyof", purchaseOrderId],
                    "AND",
                    ["cogs", "is", "F"],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "item",
                        summary: "GROUP"
                    }),
                    search.createColumn({
                        name: "quantity",
                        summary: "SUM"
                    })
                ]
        });
        var searchResult = transactionSearchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('save search length', searchResult.length);
        if (searchResult.length > 0) {
            var quantity = searchResult[0].getValue({
                name: "quantity",
                summary: "SUM"
            });
            log.debug('quantity Value', quantity);
            quantity = quantity < 0 ? quantity * (-1) : quantity;
            value = quantity;
        }

        return value;

    }

    function shipmentNoteTotalQty(releaseOrderId) {
        var value = 0;
        var transactionSearchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters:
                [
                    ["type", "anyof", "CuTrSale102"],
                    "AND",
                    ["custbodycustbody159", "anyof", releaseOrderId],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["cogs", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "quantity",
                        summary: "SUM"
                    })
                ]
        });
        var searchResult = transactionSearchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('save search length', searchResult.length);
        if (searchResult.length > 0) {
            var quantity = searchResult[0].getValue({
                name: "quantity",
                summary: "SUM"
            });
            log.debug('quantity Value', quantity);
            quantity = quantity < 0 ? quantity * (-1) : quantity;
            value = quantity;
        }

        return value;

    }

    function releaseOrderTotalQty(releaseOrderId) {
        var value = 0;
        var transactionSearchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters:
                [
                    ["type", "anyof", "CuTrSale103"],
                    "AND",
                    ["internalid", "anyof", releaseOrderId],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["cogs", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"]
                ],
            columns:
                [
                    search.createColumn({
                        name: "quantity",
                        summary: "SUM"
                    })
                ]
        });
        var searchResult = transactionSearchObj.run().getRange({
            start: 0,
            end: 1000
        });
        log.debug('save search length', searchResult.length);
        if (searchResult.length > 0) {
            var quantity = searchResult[0].getValue({
                name: "quantity",
                summary: "SUM"
            });
            log.debug('quantity Value', quantity);
            quantity = quantity < 0 ? quantity * (-1) : quantity;
            value = quantity;
        }

        return value;

    }


    return {
        beforeLoad: beforeLoad,
        afterSubmit: afterSubmit,
        totalQuantity: totalQuantity,
        totalQuantityshipmentNote: totalQuantityshipmentNote

    };
});
