/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search'],
    (record, search) => {

        function afterSubmit(context) {
            try {
                processWorkOrderChain(context.newRecord);
            } catch (e) {
                log.error('Error in afterSubmit', e);
            }
        }

        /**
         * Process the Work Order chain and update dates
         */
        function processWorkOrderChain(newRec) {
            // Find the root Work Order (the one ultimately created from a Sales Order)
            const rootWO = findRootWO(newRec);

            if (!rootWO) {
                log.debug("No root WO from Sales Order found, skipping");
                return;
            }

            const rootStartDate = rootWO.getValue('startdate');
            const rootEndDate = rootWO.getValue('enddate');

            // Build chain of WOs from current down to all children recursively
            let woChain = [];
            buildWOChain(newRec.id, woChain);

            if (woChain.length > 0) {
                log.debug('Updating WO Chain', woChain);

                woChain.forEach(id => {
                    record.submitFields({
                        type: record.Type.WORK_ORDER,
                        id: id,
                        values: {
                            startdate: rootStartDate,
                            enddate: rootEndDate
                        },
                        options: {enableSourcing: false, ignoreMandatoryFields: true}
                    });
                });
            }
        }

        /**
         * Recursively find the root Work Order (the one that ultimately comes from a Sales Order).
         * If the current WO was created from a Sales Order, return it directly.
         * If not, follow "createdfrom" backwards until found.
         */
        function findRootWO(workOrderRec) {
            let currentRec = workOrderRec;

            while (currentRec) {
                const createdFromID = currentRec.getValue('createdfrom');
                if (!createdFromID) return null;

                const createdFromData = search.lookupFields({
                    type: search.Type.TRANSACTION,
                    id: createdFromID,
                    columns: ['type']
                });

                const typeText = createdFromData?.type?.[0]?.text || '';

                if (typeText.includes('Sales Order')) {
                    // This WO is the root (created from Sales Order)
                    return currentRec;
                }

                if (typeText.includes('Work Order')) {
                    // Load parent WO and continue searching upwards
                    currentRec = record.load({
                        type: record.Type.WORK_ORDER,
                        id: createdFromID,
                        isDynamic: false
                    });
                } else {
                    // Any other type breaks the chain
                    return null;
                }
            }

            return null;
        }

        /**
         * Recursively build a list of all child Work Orders
         */
        function buildWOChain(woId, chain) {
            if (chain.includes(woId)) return;
            chain.push(woId);

            const wo = record.load({
                type: record.Type.WORK_ORDER,
                id: woId,
                isDynamic: false
            });

            const lineCount = wo.getLineCount({sublistId: 'item'});
            for (let i = 0; i < lineCount; i++) {
                const childWoId = wo.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'woid',
                    line: i
                });
                if (childWoId) {
                    buildWOChain(childWoId, chain);
                }
            }
        }

        return {afterSubmit};
    });
