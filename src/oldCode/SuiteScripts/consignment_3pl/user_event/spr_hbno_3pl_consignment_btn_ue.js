/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record'],
    function (record) {

        const beforeLoad = (context) => {
            const {newRecord, form, type} = context;
            const cid = newRecord.id;

            if (type === context.UserEventType.VIEW) {
                let consignment3pl = newRecord.getValue({
                    fieldId: 'custbody_created_form'
                });
                log.debug('consignment3pl value', consignment3pl);

                let status = newRecord.getValue({
                    fieldId: 'shipstatus'
                });
                log.debug('status value', status);

                if (!consignment3pl && status === 'C') {
                    form.addButton({
                        id: "custpage_3pl_consignment",
                        label: "3PL Consignment",
                        functionName: 'create_3pl_consignment("' + cid + '")'
                    });
                    form.clientScriptModulePath = "../client/srp_hbno_3pl_consignment_cs.js";
                    log.debug('userevent', 'running');
                }
            }
        }

        return {
            beforeLoad,
        };
    });

