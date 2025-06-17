/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record'],
    (record) => {

        /**
         * Triggered after an Item Fulfillment is created or deleted.
         *
         * @param {UserEventContext} context
         */
        const afterSubmit = (context) => {
            try {
                const eventType = context.type;
                if (eventType === context.UserEventType.CREATE || eventType === context.UserEventType.DELETE) {
                    log.debug('Triggering fulfillment handling', `Event Type: ${eventType}`);
                    handleFulfillmentAfterSubmit(context);
                }
            } catch (e) {
                log.error('Error in afterSubmit', e);
            }
        };

        /**
         * Reads items from the fulfillment and updates related custom sales order.
         *
         * @param {UserEventContext} context
         */
        const handleFulfillmentAfterSubmit = (context) => {
            const recordData = context.type === context.UserEventType.DELETE ? context.oldRecord : context.newRecord;
            const createdFromId = recordData.getValue('createdfrom');
            log.debug('Created From ID', createdFromId);

            if (!createdFromId) return;

            const itemTotals = [];
            const lineCount = recordData.getLineCount({sublistId: 'item'});

            for (let i = 0; i < lineCount; i++) {
                const itemId = recordData.getSublistValue({sublistId: 'item', fieldId: 'item', line: i});
                const quantity = parseFloat(recordData.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })) || 0;

                if (!itemId || quantity <= 0) continue;

                const existing = itemTotals.find(obj => Number(obj.itemId) === Number(itemId));
                if (existing) {
                    existing.fulfilledQty += (context.type === context.UserEventType.CREATE ? quantity : -quantity);
                } else {
                    itemTotals.push({
                        itemId,
                        fulfilledQty: context.type === context.UserEventType.CREATE ? quantity : -quantity
                    });
                }
            }

            log.debug('Item Quantities from Fulfillment', itemTotals);

            updateCustomSalesOrderLines(createdFromId, itemTotals, context.type);
        };

        /**
         * Updates fulfilled and remaining quantity fields on the sales order.
         * Updates order status based on remaining quantities.
         *
         * @param {number|string} salesOrderId
         * @param {{ itemId: number|string, fulfilledQty: number }[]} fulfilledItems
         * @param {'create'|'delete'} eventType
         */
        const updateCustomSalesOrderLines = (salesOrderId, fulfilledItems, eventType) => {
            try {
                const customSo = record.load({
                    type: 'customsale_srp_3_pl_salesorder',
                    id: salesOrderId,
                    isDynamic: false,
                });

                const lineCount = customSo.getLineCount({sublistId: 'item'});
                let allZeroRemaining = true;

                fulfilledItems.forEach(({itemId, fulfilledQty}) => {
                    for (let i = 0; i < lineCount; i++) {
                        const soItemId = customSo.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i,
                        });

                        if (Number(soItemId) === Number(itemId)) {
                            const originalQty = Number(customSo.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'quantity',
                                line: i,
                            })) || 0;

                            let currentFulfilled = Number(customSo.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_srp_3pl_quantity',
                                line: i,
                            })) || 0;

                            currentFulfilled += fulfilledQty;
                            currentFulfilled = Math.max(currentFulfilled, 0);

                            const remaining = Math.max(originalQty - currentFulfilled, 0);
                            log.debug('Remaining', remaining);
                            log.debug('currentFulfilled', currentFulfilled);

                            customSo.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_srp_3pl_quantity',
                                line: i,
                                value: currentFulfilled,
                            });

                            customSo.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_srp_3pl_remaining_qty',
                                line: i,
                                value: remaining,
                            });

                            log.debug(`Line ${i}`, `Item: ${itemId}, Fulfilled: ${currentFulfilled}, Remaining: ${remaining}`);

                            if (remaining > 0) {
                                allZeroRemaining = false;
                            }

                            break;
                        }
                    }
                });

                // Update order status
                if (allZeroRemaining) {
                    log.debug('All items fulfilled. Setting status to Fulfilled.');
                    customSo.setValue({
                        fieldId: 'transtatus',
                        value: 'G' // Update to your actual fulfilled status ID
                    });
                } else if (eventType === 'delete') {
                    log.debug('Item(s) unfulfilled. Setting status to Pending Fulfillment.');
                    customSo.setValue({
                        fieldId: 'transtatus',
                        value: 'E' // Update to your actual pending fulfillment status ID
                    });
                }

                const id = customSo.save({ignoreMandatoryFields: true});
                log.audit('Custom Sales Order updated', `ID: ${id}`);

            } catch (e) {
                log.error('Error updating custom sales order', e);
            }
        };

        return {afterSubmit};
    });
