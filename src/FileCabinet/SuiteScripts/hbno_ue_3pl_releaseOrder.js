/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'],
    (record, search, log) => {

        /**
         * Deletes the custompurchase_srp_r3plo record referenced by custbody_created_form,
         * then deletes the custompurchase_srp_3pl_purchase_order record associated with that r3plo.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        function deleteAssociated3PLPurchaseOrders(context) {
            try {
            const {newRecord} = context;
                const r3ploId = newRecord.getValue({fieldId: 'custbody_created_form'});

                if (!r3ploId) {
                    log.debug('No r3ploId found, skipping deletion.');
                    return;
                }

                // Lookup the custompurchase_srp_r3plo record to get its createdfrom field
                let custompurchase_srp_r3plo;
                try {
                    custompurchase_srp_r3plo = search.lookupFields({
                        type: "custompurchase_srp_r3plo",
                        id: r3ploId,
                        columns: ['createdfrom']
                    });
                } catch (e) {
                    log.error('Error looking up custompurchase_srp_r3plo', e.message);
                    return;
                }
                log.debug('custompurchase_srp_r3plo', custompurchase_srp_r3plo)


                // Validate createdfrom field exists and is an array with at least one element using ECMA6 optional chaining
                let consignmentId = null;
                if (
                    Array.isArray(custompurchase_srp_r3plo?.createdfrom) &&
                    custompurchase_srp_r3plo.createdfrom.length > 0 &&
                    custompurchase_srp_r3plo.createdfrom[0] &&
                    typeof custompurchase_srp_r3plo.createdfrom[0].value !== 'undefined'
                ) {
                    consignmentId = custompurchase_srp_r3plo.createdfrom[0].value;
                } else {
                    log.debug('No valid createdfrom found in custompurchase_srp_r3plo', custompurchase_srp_r3plo?.createdfrom);
                }

                // Delete the custompurchase_srp_r3plo record first
                try {
                    record.delete({type: 'custompurchase_srp_r3plo', id: r3ploId});
                } catch (e) {
                    log.error('Error deleting custompurchase_srp_r3plo', e.message);
                }
                // Delete the associated custompurchase_srp_3pl_purchase_order if consignmentId is valid
                if (consignmentId && !isNaN(consignmentId) && Number(consignmentId) > 0) {



                    try {
                        record.delete({type: 'custompurchase_srp_3pl_purchase_order', id: consignmentId});
                    } catch (e) {
                        log.error('Error deleting custompurchase_srp_3pl_purchase_order', e.message);
                    }
                }
                log.debug('idFulfillment', idFulfillment)




            } catch (e) {
                log.error('Error deleting associated 3PL POs', e.message);
            }
        }

        /**
         * Sets the remaining quantity for all item sublist lines.
         * Only runs in CREATE mode.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        function setZeroOnRemainingQty(context) {
            try {
                const {newRecord} = context;
                const lineCount = newRecord.getLineCount({sublistId: 'item'});
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
            } catch (e) {
                log.error('Error setting remaining quantity to zero', e.message);
            }
        }

        /**
         * User Event beforeSubmit entry point.
         * Calls setZeroOnRemainingQty to set remaining quantity to zero for all item lines.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        function beforeSubmit(context) {
            // Set remaining quantity for all item lines in CREATE mode
            if (context.type === context.UserEventType.CREATE)
                setZeroOnRemainingQty(context);
        }


        /**
         * afterSubmit User Event entry point.
         * Only runs in DELETE mode.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        const afterSubmit = (context) => {
            if (context.type === context.UserEventType.DELETE)
                deleteAssociated3PLPurchaseOrders(context);
        }

        return {
            afterSubmit,
            beforeSubmit
        };
    });
