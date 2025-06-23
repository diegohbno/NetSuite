/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/runtime', 'N/record', 'N/search'],
    (runtime, record, search) => {
        /**
         * Adds the 3PL Consignment button to the form if the record meets the criteria.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        function add3PLConsignmentButton(context) {
            try {
                const {newRecord, form} = context;
                const cid = newRecord.id;

                let consignment3pl = newRecord.getValue({fieldId: 'custbody_created_form'});
                let status = newRecord.getValue({fieldId: 'shipstatus'});
                let showButton = false;

                if (!consignment3pl && status === 'C') {
                    const createdFrom = newRecord.getValue({fieldId: 'createdfrom'});
                    if (createdFrom) {
                        const soFields = search.lookupFields({
                            type: record.Type.SALES_ORDER,
                            id: createdFrom,
                            columns: ['department']
                        });
                        const departmentId = soFields?.department?.[0]?.value;
                        const privateLabelDep = runtime.getCurrentScript().getParameter({name: "custscript_hbno_ue_3pl_private_label_dep"});
                        if (departmentId === privateLabelDep) {
                            showButton = true;
                        }
                    }
                }

                if (showButton) {
                    form.addButton({
                        id: "custpage_3pl_consignment",
                        label: "3PL Consignment DIEGO",
                        functionName: `create_3pl_consignment("${cid}")`
                    });
                    form.clientScriptModulePath = runtime.getCurrentScript().getParameter({name: "custscript_hbno_if_client_path_logic"});
                }
            } catch (e) {
                log.error('ERROR in add3PLConsignmentButton', e.message);
            }
        }

        /**
         * beforeLoad User Event entry point.
         * @param {UserEventContext} context - NetSuite User Event context object
         */
        const beforeLoad = (context) => {
            // Only run in VIEW mode
            if (context.type === context.UserEventType.VIEW) {
                add3PLConsignmentButton(context);
            }
        }

        return {
            beforeLoad,
        };
    });
