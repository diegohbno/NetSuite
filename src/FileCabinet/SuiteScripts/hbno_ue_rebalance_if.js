/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/search', 'N/log', 'N/runtime', '../SuiteScripts/Lib/currency.min'],
    (record, search, log, runtime, currency) => {

        /**
         * Main function to handle Journal Entry creation after Item Fulfillment is shipped.
         * @param {UserEventContext.afterSubmit} context
         */
        function afterSubmit(context) {
            try {
                log.debug('context.type',context.type)
                if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT
                && context.type !== context.UserEventType.SHIP) return;

                const fulfillment = context.newRecord;
                log.debug('Item Fulfillment submitted', `ID: ${fulfillment.id}`);
                handleJournalEntryForFulfillment(fulfillment);
            } catch (error) {
                log.error('Error in afterSubmit', error);
            }
        }

        /**
         * Processes an Item Fulfillment to generate a Journal Entry if status is Shipped.
         *
         * @param {Record} fulfillment - The Item Fulfillment record.
         */
        function handleJournalEntryForFulfillment(fulfillment) {
            try {
                var status2 =  fulfillment.getValue({fieldId: 'status'});
                log.debug('status22',status2)
                const fulfillmentId = fulfillment.id;

                // Only proceed if status is Shipped
                const status = search.lookupFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    columns: ['status']
                })?.status?.[0]?.text;
                log.debug('Fulfillment status', status);
                log.debug('Fulfillment status', status);

                const consigmentJe = fulfillment.getValue({fieldId: 'custbody_consignment_je_in_if'});
                if (consigmentJe) {
                    log.audit('Skipping Journal Entry', 'consigmentJe populated');
                    return;
                }
                log.debug('Fulfillment', fulfillment);
                log.debug('Fulfillment status', status);
                if (status !== 'Shipped') {
                    log.audit('Skipping Journal Entry', 'Status is not Shipped');
                    return;
                }

                const createdFromId = fulfillment.getValue({fieldId: 'createdfrom'});
                log.debug('Created From Sales Order', createdFromId);

                // Run saved search 4768 to get the amount for this fulfillment
                let totalAmount = currency(0);
                var itemfulfillmentSearchObj = search.create({
                    type: record.Type.ITEM_FULFILLMENT,
                    filters:
                        [
                            ["mainline", "is", "F"],
                            "AND",
                            ["internalidnumber", "equalto", fulfillmentId],
                            "AND",
                            ["status", "anyof", "ItemShip:C"],
                            "AND",
                            ["account", "anyof", "211"]
                        ],
                    columns:
                        [
                            search.createColumn({name: "creditamount", label: "Amount (Credit)"})
                        ]
                });
                var searchResultCount = itemfulfillmentSearchObj.runPaged().count;
                log.debug("itemfulfillmentSearchObj result count", searchResultCount);
                itemfulfillmentSearchObj.run().each(function (result) {
                    const amount = result.getValue({name: result.columns[0]}) || 0;
                    totalAmount = totalAmount.add(amount);
                    return true;
                });

                log.debug('Total amount from saved search 4768', totalAmount.value);

                if (totalAmount.value === 0) {
                    log.audit('No amount found in saved search 4768 for this fulfillment.');
                    return;
                }
                const script = runtime.getCurrentScript();
                const inventoryAccountId = parseInt(script.getParameter({name: 'custscript_hbno_account_inv_raw_mat_if'}));
                const cogsAccountId = parseInt(script.getParameter({name: 'custscript_hbno_account_cost_goods_if'}));

                // Create Journal Entry: Debit 12000, Credit 50, link to fulfillment
                const je = record.create({
                    type: record.Type.JOURNAL_ENTRY,
                    isDynamic: true
                });
                je.setValue({fieldId: 'subsidiary', value: 2}); //todo parameter

                // Debit line (account 12000)
                je.selectNewLine({sublistId: 'line'});
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: inventoryAccountId
                });
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: totalAmount.value
                });
                je.commitLine({sublistId: 'line'});

                // Credit line (account 50)
                je.selectNewLine({sublistId: 'line'});
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: cogsAccountId
                });
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: totalAmount.value
                });
                je.commitLine({sublistId: 'line'});
                const salesOrderId = fulfillment.getValue({fieldId: 'createdfrom'});
                log.debug('salesOrderId', salesOrderId)
                // Link JE to Item Fulfillment
                je.setValue({
                    fieldId: 'custbody_consignment_order', // Replace with actual custom field ID if needed
                    value: salesOrderId
                });

                const jeId = je.save();
                log.audit('Journal Entry created', `ID: ${jeId}, Amount: ${totalAmount.value}`);
                // Link consignment to fulfillment
                record.submitFields({
                    type: record.Type.ITEM_FULFILLMENT,
                    id: fulfillmentId,
                    values: {'custbody_consignment_je_in_if': jeId},
                    options: {enableSourcing: false, ignoreMandatoryFields: true}
                });
            } catch (error) {
                log.error('Error in handleJournalEntryForFulfillment', error);
            }
        }

        return {afterSubmit};
    });
