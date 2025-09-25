/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/url'], (url) => {

    const beforeLoad = (context) => {
        const { newRecord, form, type, UserEventType } = context;
        const recordId = newRecord.id;
        const recordType = newRecord.type;

        // Solo al ver un registro existente
        if (type === UserEventType.VIEW && recordId) {
            // Botón custom
            form.addButton({
                id: 'custpage_attach_label',
                label: 'Print Label DIEGO',
                functionName: `attach_label("${recordId}", "${recordType}")`
            });

            // Vincular Client Script
            form.clientScriptFileId = 889097;

            // --- Columna con hyperlink al PDF ---
            let sublist = form.getSublist({ id: 'item' });
            if (sublist) {
                sublist.addField({
                    id: 'custpage_hbno_label_pdf_link',
                    label: 'Label PDF Link',
                    type: 'url'
                });

                let lineCount = newRecord.getLineCount({ sublistId: 'item' });

                for (let i = 0; i < lineCount; i++) {
                    let fileId = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_hbno_label_pdf',
                        line: i
                    });

                    if (fileId) {
                        let fileUrl = url.resolveRecord({
                            recordType: 'file',
                            recordId: fileId,
                            isEditMode: false
                        });

                        newRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custpage_hbno_label_pdf_link',
                            line: i,
                            value: fileUrl
                        });
                    }
                }
            }
        }
    };

    return { beforeLoad };
});
