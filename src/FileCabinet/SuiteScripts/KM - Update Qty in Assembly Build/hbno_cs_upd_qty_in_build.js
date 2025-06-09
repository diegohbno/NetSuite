/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/record'],
(record) => {

    const fieldChanged = (context) => {
        try {
            let fieldId = context.fieldId;
            let sublistId = context.sublistId;
            let buildRec = context.currentRecord;

            if (fieldId == 'quantity' && !sublistId) {
                let woId = buildRec.getValue('createdfrom');
                if (!woId) return;
                
                log.debug('context', `fieldId: ${fieldId} | sublistId: ${sublistId}`);

                let workOrder = record.load({type: record.Type.WORK_ORDER, id: woId});
                for (let i = 0; i < buildRec.getLineCount('component'); i++) {
                    let woQty = workOrder.getSublistValue('item', 'quantity', i);
                    buildRec.selectLine('component', i);
                    buildRec.setCurrentSublistValue({
                        sublistId: 'component',
                        fieldId: 'quantity',
                        value: woQty
                    });
                    let updBuildQty = buildRec.getCurrentSublistValue('component', 'quantity');
                    log.debug(i, `woQty: ${woQty} | updBuildQty: ${updBuildQty}`)
                }
            }
        }
        catch (e) {log.error('Error in fieldChanged', e)}
    }


    return {fieldChanged};
});