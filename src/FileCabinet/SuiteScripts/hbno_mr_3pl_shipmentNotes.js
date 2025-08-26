/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log', 'N/runtime'], (search, record, log, runtime) => {

    /**
     * Loads the sales order search and returns results.
     * Instead of processing all SOs, this version expects a single SO id as a parameter and uses it as a filter.
     * @returns {Array} Array of objects with salesOrderId and shipNoteItemsMap for reduce.
     */
    const getInputData = () => {
        try {
            // You can pass the SO id as a script parameter or hardcode for testing
            const shipID = '1120086'; // fallback to a test id
            log.debug('getInputData', `Using Sales Order ID: ${shipID}`);
            const itemFullfimentRecord = record.load({
                type: 'customsale_srp_f3plo',
                id: shipID
            });
            const salesOrderId = itemFullfimentRecord.getValue('createdfrom');
            log.debug('salesOrderId', salesOrderId);
            if (!salesOrderId) return;

            // Load the related sales order to get the correct remaining qty per item
            let salesOrder;
            try {
                salesOrder = record.load({
                    type: 'customsale_srp_3_pl_salesorder',
                    id: salesOrderId,
                    isDynamic: false
                });
                log.debug('Sales order loaded', {salesOrderId});
            } catch (e) {
                log.error('Could not load related sales order', {createdsalesOrderIdFromId, error: e});
                return;
            }

            const itemTotals = [];
            var  lineCount = itemFullfimentRecord.getLineCount({sublistId: 'item'});
            log.debug('Line Count', lineCount);

            for (let i = 0; i < lineCount; i++) {
                const itemId = itemFullfimentRecord.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                const quantity = parseFloat(itemFullfimentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })) || 0;

                log.debug('Item line', {line: i, itemId, quantity});

                if (!itemId || quantity <= 0) continue;

                const existing = itemTotals.find(obj => Number(obj.itemId) === Number(itemId));

                if (existing) {
                    existing.fulfilledQty += quantity;
                } else {
                    itemTotals.push({
                        itemId,
                        fulfilledQty: quantity
                    });
                }
            }
            log.debug('itemTotals', itemTotals);























            const itemFulfilledTotals = {};
            const shipNoteSearch = search.create({
                type: 'customsale_srp_f3plo',
                filters: [
                    ["custbodycustbody159","anyof",salesOrderId],
                    "AND",
                    ["item","noneof","@NONE@"]
                ],
                columns: [
                    search.createColumn({
                        name: "quantity",
                        summary: "SUM",
                        label: "Quantity"
                    }),
                    search.createColumn({
                        name: "item",
                        summary: "GROUP",
                        label: "Item"
                    })
                ]
            });
            const results = shipNoteSearch.run().getRange({start: 0, end: 1000});
            log.audit('0000 Shipment note search results', results);
            if (results && results.length > 0) {
                results.forEach(result => {
                    const itemId = result.getValue({name: 'item', summary: 'GROUP'});
                    const fulfilledQty = Number(result.getValue({name: 'quantity', summary: 'SUM'})) || 0;
                    itemFulfilledTotals[itemId] = fulfilledQty;
                    log.debug('Aggregated fulfilledQty', {itemId, fulfilledQty});
                });
            }

            // Load the sales order
            const customSo = record.load({
                type: 'customsale_srp_3_pl_salesorder',
                id: salesOrderId,
                isDynamic: false,
            });
            log.debug('Loaded custom sales order', {salesOrderId});

            lineCount = customSo.getLineCount({sublistId: 'item'});
            let allZeroRemaining = true;
            // Map to store remaining qty per item
            const itemRemainingQtyMap = {};

            for (let i = 0; i < lineCount; i++) {
                const soItemId = customSo.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i,
                });
                const lineQty = Number(customSo.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i,
                })) || 0;

                // Get total fulfilled for this item from all shipment notes
                const totalFulfilled = itemFulfilledTotals[soItemId] || 0;
                const remaining = Math.max(lineQty - totalFulfilled, 0);

                log.debug('Updating SO line', {line: i, soItemId, lineQty, totalFulfilled, remaining});

                // Set fulfilled and remaining qty fields
                customSo.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_srp_3pl_quantity',
                    line: i,
                    value: totalFulfilled
                });

                customSo.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_srp_3pl_remaining_qty',
                    line: i,
                    value: remaining
                });

                itemRemainingQtyMap[soItemId] = {
                    remaining,
                    fulfilled: totalFulfilled
                };

                if (remaining > 0) {
                    allZeroRemaining = false;
                }
            }

            // Update order status
            if (allZeroRemaining) {
                log.debug('All remaining qty zero, setting status to fulfilled');
                customSo.setValue({
                    fieldId: 'transtatus',
                    value: 'G' // Update to your actual fulfilled status ID
                });

            }

            const id = customSo.save({ignoreMandatoryFields: true});
            log.audit('Custom Sales Order updated', `ID: ${id}`);

            // --- Update remaining qty and fulfilled qty on all related customsale_srp_f3plo records ---
            // Group by internalid to avoid loading the same record multiple times
            const relatedShipNotesSearch = search.create({
                type: 'customsale_srp_f3plo',
                filters: [
                    ["custbodycustbody159","anyof",salesOrderId],
                    "AND",
                    ["mainline","is","F"]
                ],
                columns: [
                    search.createColumn({
                        name: "internalid",
                        summary: "GROUP"
                    }),
                    search.createColumn({
                        name: "item",
                        summary: "GROUP"
                    })
                ]
            });
            const relatedShipNotes = relatedShipNotesSearch.run().getRange({start: 0, end: 1000});
            log.audit('11 Related shipment notes to update remaining and fulfilled qty', relatedShipNotes);

            // Map: { shipNoteId: [itemId1, itemId2, ...] }
            const shipNoteItemsMap = {};
            if (relatedShipNotes && relatedShipNotes.length > 0) {
                relatedShipNotes.forEach(note => {
                    const shipNoteId = note.getValue({name: 'internalid', summary: 'GROUP'});
                    const itemId = note.getValue({name: 'item', summary: 'GROUP'});
                    if (!shipNoteItemsMap[shipNoteId]) {
                        shipNoteItemsMap[shipNoteId] = [];
                    }
                    shipNoteItemsMap[shipNoteId].push(itemId);
                });
            }
            log.audit('shipNoteItemsMap', shipNoteItemsMap);

            // For each shipNoteId, return an input for reduce
            return Object.entries(shipNoteItemsMap).map(([shipNoteId, itemIds]) => ({
                salesOrderId,
                shipNoteId,
                itemIds
            }));
        } catch (e) {
            log.error('Error in getInputData', e);
        }
    };


    /**
     * For each shipNoteId and its items, process in a separate reduce queue.
     *
     * @param {ReduceContext} context - The reduce context.
     */
    const reduce = (context) => {
        try {
            log.debug('reduce', `Context: ${JSON.stringify(context)}`);
            const input = JSON.parse(context.values[0]);
            const { salesOrderId, shipNoteId, itemIds } = input;
            log.debug('Processing Sales Order', salesOrderId);

            /*
log.audit('shipNoteId',shipNoteId)
                        const remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                        log.audit('Unidades de gobierno restantes', remainingUsage);
                        const shipNoteRec = record.load({
                            type: 'customsale_srp_f3plo',
                            id: shipNoteId,
                            isDynamic: false
                        });
                        const itemLineCount = shipNoteRec.getLineCount({sublistId: 'item'});
                        for (let j = 0; j < itemLineCount; j++) {
                            const lineItemId = shipNoteRec.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'item',
                                line: j
                            });
                            // Only update if this item is in the map for this record
                            if (shipNoteItemsMap[shipNoteId].includes(String(lineItemId))) {
                                log.debug('itemRemainingQtyMap',itemRemainingQtyMap)
                                const qtyObj = itemRemainingQtyMap[lineItemId];
                                log.debug('qtyObj',qtyObj)
                                if (qtyObj) {
                                    shipNoteRec.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_srp_3pl_remaining_qty',
                                        line: j,
                                        value: qtyObj.remaining
                                    });
                                    shipNoteRec.setSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_srp_3pl_quantity',
                                        line: j,
                                        value: qtyObj.fulfilled
                                    });
                                }
                            }
                        }
                        shipNoteRec.save({ignoreMandatoryFields: true});

 */

            // ...your processing logic for each shipment note and its items here...

        } catch (e) {
            log.error('Error in reduce', e);
        }
    };

    const summarize = (context) => {
       // itemFullfimentRecord.save()

    }


    return {
        getInputData,
        reduce,
        summarize
    };
});
