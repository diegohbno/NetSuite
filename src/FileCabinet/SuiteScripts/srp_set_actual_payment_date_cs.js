/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/log'], function(currentRecord, log) {

    function fieldChanged(context) {
        try {
            var rec = context.currentRecord;
            var fieldId = context.fieldId;

            // Check if the changed field is 'custbody_hbno_approval_status'
            if (fieldId === 'custbody_hbno_approval_status') {
                var approvalStatus = rec.getValue('custbody_hbno_approval_status');

                // If approval status is 19, set the current date in 'custbody_srp_apd'
                if (approvalStatus === 19) {
                    var currentDate = new Date();
                    rec.setValue({
                        fieldId: 'custbody_srp_apd',
                        value: currentDate
                    });
                }
            }
        } catch (e) {
            log.error({
                title: 'Error in fieldChanged',
                details: e.toString()
            });
        }
    }

    function beforeSave(context) {
        try {
            var rec = context.currentRecord;
            var approvalStatus = rec.getValue('custbody_hbno_approval_status');

            // If approval status is 19, set the current date in 'custbody_srp_apd'
            if (approvalStatus === 19) {
                var currentDate = new Date();
                rec.setValue({
                    fieldId: 'custbody_srp_apd',
                    value: currentDate
                });
            }
        } catch (e) {
            log.error({
                title: 'Error in beforeSave',
                details: e.toString()
            });
        }
    }

    return {
        fieldChanged: fieldChanged,
        saveRecord: beforeSave
    };
});
