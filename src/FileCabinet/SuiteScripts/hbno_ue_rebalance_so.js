/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record', 'N/search', 'N/log', 'N/runtime', '../SuiteScripts/Lib/currency.min'],
    (record, search, log, runtime, currency) => {

        /**
         * Main function to handle Journal Entry creation after Sales Order is submitted.
         * @param {UserEventContext.afterSubmit} context
         */
        function afterSubmit(context) {
            try {
                if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) return;

                const salesOrder = context.newRecord;
                log.debug('Sales Order submitted', `ID: ${salesOrder.id}`);
                handleJournalEntryForSalesOrder(salesOrder);
            } catch (error) {
                log.error('Error in afterSubmit', error);
            }
        }

        /**
         * Processes a Sales Order to generate a Journal Entry if conditions are met.
         *
         * @param {Record} salesOrder - The Sales Order record.
         */
        function handleJournalEntryForSalesOrder(salesOrder) {
            try {
                const salesOrderId = salesOrder.id;
                const prodCompleteDate = salesOrder.getValue({fieldId: 'custbody45'});
                const productionComplete = salesOrder.getValue({fieldId: 'custbody44'});
                const department = salesOrder.getValue({fieldId: 'department'});
                const consigmentJe = salesOrder.getValue({fieldId: 'custbody_consignment_je'});

                const privateLabelDept = parseInt(runtime.getCurrentScript().getParameter({name: 'custscript_hbno_rebalance_so_private_l'}));

                log.debug('Field values', {prodCompleteDate, productionComplete});

                if (!prodCompleteDate || !productionComplete) {
                    log.audit('Skipping Journal Entry', 'Missing prodCompleteDate or productionComplete');
                    return;
                }
                log.debug('department',typeof  department)
                log.debug('privateLabelDept',typeof privateLabelDept)
                log.debug('privateLabelDept !== department',privateLabelDept !== department)
                if (Number(privateLabelDept) !== Number(department)) {
                    log.audit('Skipping Journal Entry', 'Not Private Label Dept');
                    return;
                }
                if(consigmentJe){
                    log.audit('Skipping Journal Entry', 'consigmentJe populated');
                    return;
                }

                // Use currency.js for math
                let totalCost = currency(0);
                const lineCount = salesOrder.getLineCount({sublistId: 'item'});
                log.debug('Item lines count', lineCount);

                // Collect unique woIds
                const uniqueWoIds = new Set();
                for (let i = 0; i < lineCount; i++) {
                    const woId = salesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'woid', // Replace with actual field if needed
                        line: i
                    });
                    if (woId) uniqueWoIds.add(woId);
                }

                log.debug('Unique Work Order IDs', Array.from(uniqueWoIds));

                // Only sum amounts for unique woIds
                uniqueWoIds.forEach(woId => {
                    const assemblyBuildSearch = search.create({
                        type: 'assemblybuild',
                        filters: [['createdfrom', 'anyof', woId], 'AND', ["mainline", "is", "T"]],
                        columns: ['total']
                    });

                    assemblyBuildSearch.run().each(result => {
                        const total = result.getValue('total') || 0;
                        log.debug('Assembly Build found', {woId, total});
                        totalCost = totalCost.add(total);
                        return true;
                    });
                });

                log.debug('Total cost', totalCost);
                log.debug('Total cost from Assembly Builds', totalCost.value);
                log.debug('Total cost from Assembly Builds', typeof totalCost.value);

                if (totalCost.value === 0) {
                    log.audit('No Assembly Build amount found for related Work Orders.');
                    return;
                }

                const inventoryAccountId = parseInt(runtime.getCurrentScript().getParameter({name: 'custscript_hbno_account_inv_raw_mat_so'}));
                const cogsAccountId = parseInt(runtime.getCurrentScript().getParameter({name: 'custscript_hbno_account_cost_goods_so'}));

                log.debug('Account parameter values', {inventoryAccountId, cogsAccountId});

                if (!inventoryAccountId || !cogsAccountId) {
                    log.error('Missing script parameters', {
                        inventoryAccountId,
                        cogsAccountId
                    });
                    return;
                }

                const je = record.create({
                    type: record.Type.JOURNAL_ENTRY,
                    isDynamic: true
                });
                je.setValue({fieldId: 'subsidiary', value: 2}); //todo parameter

                // Credit line
                je.selectNewLine({sublistId: 'line'});
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: inventoryAccountId
                });
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'credit',
                    value: totalCost.value
                });
                je.commitLine({sublistId: 'line'});

                // Debit line
                je.selectNewLine({sublistId: 'line'});
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'account',
                    value: cogsAccountId
                });
                je.setCurrentSublistValue({
                    sublistId: 'line',
                    fieldId: 'debit',
                    value: totalCost.value
                });
                je.commitLine({sublistId: 'line'});

                // Link JE to Sales Order
                je.setValue({
                    fieldId: 'custbody_consignment_order', // Replace with actual custom field ID
                    value: salesOrderId
                });

                const jeId = je.save();
                log.audit('Journal Entry created', `ID: ${jeId}, Amount: ${totalCost.value}`);
                // Link consignment to fulfillment
                record.submitFields({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    values: {'custbody_consignment_je': jeId},
                    options: {enableSourcing: false, ignoreMandatoryFields: true}
                });

            } catch (error) {
                log.error('Error in handleJournalEntryForSalesOrder', error);
            }
        }

        return {afterSubmit};
    });
