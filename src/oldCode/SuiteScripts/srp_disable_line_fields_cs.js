/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord'], /**
 * @param {record} record
 */ function (currentRecord) {
    /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function disableLineField(scriptContext) {
        try {
            var currentRecord = scriptContext.currentRecord;
            var sublistId = scriptContext.sublistId;

            var approvalStatus = scriptContext.currentRecord.getValue({
                fieldId: 'custbody_hbno_approval_status'
            });
            if (sublistId !== 'expense') return;

            // In SuiteScript 2.0 Line count starts with index 0;
            var lineToDisable = currentRecord.getLineCount({
                sublistId: 'expense'
            });

            var selectedLine = currentRecord.getCurrentSublistIndex({
                sublistId: 'expense'
            });


            log.debug({title: 'selectedLine', details: JSON.stringify(selectedLine)});

            if (approvalStatus !== '14' && approvalStatus !== '9' && approvalStatus !== '12' && approvalStatus !== '18') {
                return;
            }

            // Runs 5 times, with values of step 0 through 4.
            var fieldsToDisable = ['account', 'department', 'class', 'amount', 'category', 'memo'];
            fieldsToDisable.forEach(function (fieldId) {
                var field = currentRecord.getSublistField({
                    sublistId: 'expense',
                    fieldId: fieldId,
                    line: selectedLine
                });

                field.isDisabled = true;

            });

        } catch (error) {
            log.debug({title: 'Catch Error', details: error});
        }
    }


    return {
        lineInit: disableLineField
    };
});