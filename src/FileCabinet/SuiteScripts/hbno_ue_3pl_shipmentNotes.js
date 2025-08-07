/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'],
    (record, search) => {

        /**
         * Reads items from the fulfillment and updates related custom sales order.
         *
         * @param {UserEventContext} context
         */
        const handleFulfillmentAfterSubmit = (context) => {
            log.debug('handleFulfillmentAfterSubmit called', {type: context.type, id: context.newRecord?.id || context.oldRecord?.id});
            const recordData = context.type === context.UserEventType.DELETE ? context.oldRecord : context.newRecord;
            const itemFullfimentRecord = record.load({
                type: 'customsale_srp_f3plo',
                id: recordData.id
            });
            const createdFromId = recordData.getValue('createdfrom');
            log.debug('createdFromId', createdFromId);
            if (!createdFromId) return;

            // Load the related sales order to get the correct remaining qty per item
            let salesOrder;
            try {
                salesOrder = record.load({
                    type: 'customsale_srp_3_pl_salesorder',
                    id: createdFromId,
                    isDynamic: false
                });
                log.debug('Sales order loaded', {createdFromId});
            } catch (e) {
                log.error('Could not load related sales order', {createdFromId, error: e});
                return;
            }

            const itemTotals = [];
            const lineCount = recordData.getLineCount({sublistId: 'item'});
            log.debug('Line Count', lineCount);

            for (let i = 0; i < lineCount; i++) {
                const itemId = recordData.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                const quantity = parseFloat(recordData.getSublistValue({
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
            // Update sales order lines and also consider shipment notes
            updateCustomSalesOrderLines(createdFromId, itemTotals, context.type);
            if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT)
                itemFullfimentRecord.save()
        };

        /**
         * Updates fulfilled and remaining quantity fields on the sales order.
         * Aggregates all shipment notes (customsale_srp_f3plo) for the sales order and sums quantity per item.
         * Updates order status based on remaining quantities.
         * Also updates the remaining qty and fulfilled qty on all related customsale_srp_f3plo records.
         *
         * @param {number|string} salesOrderId
         * @param {{ itemId: number|string, fulfilledQty: number }[]} fulfilledItems
         * @param {'create'|'edit'|'delete'} eventType
         */
        const updateCustomSalesOrderLines = (salesOrderId, fulfilledItems, eventType) => {
            try {
                log.debug('updateCustomSalesOrderLines called', {salesOrderId, fulfilledItems, eventType});
                // Aggregate fulfilled quantities for each item from all shipment notes for this sales order
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
                log.debug('Shipment note search results', results);
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

                const lineCount = customSo.getLineCount({sublistId: 'item'});
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
                } else if (eventType === 'delete') {
                    log.debug('Event type is delete, setting status to pending fulfillment');
                    customSo.setValue({
                        fieldId: 'transtatus',
                        value: 'E' // Update to your actual pending fulfillment status ID
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
                log.debug('Related shipment notes to update remaining and fulfilled qty', relatedShipNotes);

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

                // Now load each record only once and update all its item lines
                for (const shipNoteId in shipNoteItemsMap) {
                    try {
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
                        log.debug('Updated remaining and fulfilled qty on shipment note', {shipNoteId, items: shipNoteItemsMap[shipNoteId]});
                    } catch (e) {
                        log.error('Error updating remaining/fulfilled qty on shipment note', {shipNoteId, error: e});
                    }
                }
            } catch (e) {
                log.error('Error updating custom sales order', e);
            }
        };

        /**
         * Returns the total fulfilled quantity for a given sales order and item,
         * summing all shipment notes (customsale_srp_f3plo) associated to the sales order and item.
         *
         * @param {number|string} salesOrderId
         * @param {number|string} itemId
         * @returns {number}
         */
        function getTotalFulfilledFromShipmentNotes(salesOrderId, itemId) {
            let total = 0;
            try {
                log.debug('getTotalFulfilledFromShipmentNotes called', {salesOrderId, itemId});
                const shipNoteSearch = search.create({
                    type: 'customsale_srp_f3plo',
                    filters: [
                        ['createdfrom', 'anyof', salesOrderId],
                        'AND',
                        ['mainline', 'is', 'F'],
                        'AND',
                        ['item', 'anyof', itemId]
                    ],
                    columns: [
                        search.createColumn({name: 'custcol_srp_3pl_quantity', summary: 'SUM'})
                    ]
                });
                const results = shipNoteSearch.run().getRange({start: 0, end: 1000});
                log.debug('getTotalFulfilledFromShipmentNotes results', results);
                if (results && results.length > 0) {
                    total = Number(results[0].getValue({name: 'quantity', summary: 'SUM'})) || 0;
                }
            } catch (e) {
                log.error('Error in getTotalFulfilledFromShipmentNotes', e);
            }
            return total;
        }

        /**
         * Sets the value of custbodycustbody159 to the value of createdfrom if populated.
         * Only runs in CREATE mode.
         * @param {UserEventContext} context
         */
        function setCreatedReleaseOrder(context) {
            // Only run in CREATE mode
            const rec = context.newRecord;
            const createdFrom = rec.getValue({fieldId: 'createdfrom'});
            log.debug('setCreatedReleaseOrder', {createdFrom});
            if (createdFrom) {
                rec.setValue({
                    fieldId: 'custbodycustbody159',
                    value: createdFrom
                });
            }
        }

        /**
         * beforeLoad User Event entry point.
         * @param {UserEventContext} context
         */
        const beforeLoad = (context) => {
            try {
                log.debug('beforeLoad called', {type: context.type});
                if (context.type === context.UserEventType.CREATE)
                    setCreatedReleaseOrder(context);
            } catch (e) {
                log.error('Error in beforeLoad', e);
            }
        };

        /**
         * Triggered after an Item Fulfillment is created or deleted.
         *
         * @param {UserEventContext} context
         */
        const afterSubmit = (context) => {
            try {
                log.debug('afterSubmit called', {type: context.type});
                const eventType = context.type;
                if (eventType === context.UserEventType.CREATE ||
                    eventType === context.UserEventType.EDIT || eventType === context.UserEventType.DELETE) {
                    handleFulfillmentAfterSubmit(context);
                }
            } catch (e) {
                log.error('Error in afterSubmit', e);
            }
        };

        return {
            beforeLoad,
            afterSubmit
        };
    });