/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record'],
    (record) => {

        /**
         * Reads items from the fulfillment and updates related custom sales order.
         *
         * @param {UserEventContext} context
         */
        const handleFulfillmentAfterSubmit = (context) => {
            const recordData = context.type === context.UserEventType.DELETE ? context.oldRecord : context.newRecord;
            const itemFullfimentRecord = record.load({
                type: 'customsale_srp_f3plo',
                id: recordData.id
            });
            const createdFromId = recordData.getValue('createdfrom');
            if (!createdFromId) return;

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
                if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
                    itemFullfimentRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_3pl_quantity',
                        line: i,
                        value: quantity
                    });
                    let remainingQty = Number(itemFullfimentRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_3pl_remaining_qty',
                        line: i,
                    })) || 0;
                    itemFullfimentRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_3pl_remaining_qty',
                        line: i,
                        value: (Number(remainingQty) - Number(quantity))
                    });

                }
            }
            updateCustomSalesOrderLines(createdFromId, itemTotals, context.type);
            if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT)
                itemFullfimentRecord.save()
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

                            customSo.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_srp_3pl_quantity',
                                line: i,
                                value: remaining
                            });

                            customSo.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_srp_3pl_remaining_qty',
                                line: i,
                                value: currentFulfilled
                            });
                            if (remaining > 0) {
                                allZeroRemaining = false;
                            }

                            break;
                        }
                    }
                });

                // Update order status
                if (allZeroRemaining) {
                    customSo.setValue({
                        fieldId: 'transtatus',
                        value: 'G' // Update to your actual fulfilled status ID
                    });
                } else if (eventType === 'delete') {
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

        /**
         * Sets the value of custbodycustbody159 to the value of createdfrom if populated.
         * Only runs in CREATE mode.
         * @param {UserEventContext} context
         */
        function setCreatedReleaseOrder(context) {
            // Only run in CREATE mode
            const rec = context.newRecord;
            const createdFrom = rec.getValue({fieldId: 'createdfrom'});
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
