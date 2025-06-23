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
        function beforeSubmit(context) {
            try {

                let newRecord = context.newRecord;
                let lineCount = newRecord.getLineCount({sublistId: 'item'});

                log.audit('lineCount', lineCount);
                for (let i = 0; i < lineCount; i++) {
                    const quantity = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    }) || 0;
                    newRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_3pl_remaining_qty',
                        line: i,
                        value: quantity


                    })
                }

            } catch (error) {
                log.error('Error in hiding the button for fully received SO', error);
            }

        };


        return {beforeSubmit};
    });
