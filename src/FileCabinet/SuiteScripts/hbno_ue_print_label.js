/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */

define(['N/record'], function (record) {

    const beforeLoad = (context) => {
        const { newRecord, form, type } = context;
        const cid = newRecord.id;
        const recordType = newRecord.type;

        if (type == context.UserEventType.VIEW) {

            form.addButton({
                id: "custpage_attach_label",
                label: "Attach Label DIEGO",
                functionName: 'attach_label("' + cid + '", "'+ recordType +'")'
            });
            form.clientScriptFileId = 889096;
        }
    }

    return {
        beforeLoad,
    };
});
