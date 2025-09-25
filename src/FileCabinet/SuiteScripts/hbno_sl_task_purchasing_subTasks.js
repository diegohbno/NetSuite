/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 * @description
 * Suitelet that displays vendor ranking records in a sublist.
 * Users can select rows with a checkbox. On submit, a custom record
 * (`customrecord4735`) is created for each selected row.
 * The Suitelet also saves the selected item (Item ID) and calculates future dates.
 */
define(['N/ui/serverWidget', 'N/record', 'N/search'],
    (ui, record, search) => {

        /**
         * Safely sets a sublist value if it's not null or empty.
         * @param {Object} sublist - The sublist object
         * @param {string} fieldId - The sublist field ID
         * @param {number} line - The line index
         * @param {any} value - The value to set
         */
        function safeSetSublistValue(sublist, fieldId, line, value) {
            if (value !== null && value !== undefined && value !== '') {
                sublist.setSublistValue({
                    id: fieldId,
                    line: line,
                    value: String(value)
                });
            }
        }

        /**
         * Builds the vendor ranking sublist on the Suitelet form.
         * @param {serverWidget.Form} form - The Suitelet form
         * @param {number} itemID - Internal ID of the related item
         */
        function buildSublist(form, itemID) {
            const sublist = form.addSublist({
                id: 'custpage_result_sublist',
                type: ui.SublistType.LIST,
                label: 'Vendor Rankings'
            });

            // Add checkbox column with "Mark All" button
            sublist.addMarkAllButtons();
            sublist.addField({
                id: 'custpage_select',
                type: ui.FieldType.CHECKBOX,
                label: 'Select'
            });

            // Add visible data columns
            sublist.addField({id: 'custpage_id', type: ui.FieldType.TEXT, label: 'ID'});
            sublist.addField({id: 'custpage_dontquote', type: ui.FieldType.TEXT, label: 'DONT QUOTE'});
            sublist.addField({id: 'custpage_note', type: ui.FieldType.TEXT, label: 'Purchasing Note'});
            sublist.addField({id: 'custpage_impdom', type: ui.FieldType.TEXT, label: 'IMP / DOM'});
            sublist.addField({id: 'custpage_moq', type: ui.FieldType.TEXT, label: 'MOQ'});
            sublist.addField({id: 'custpage_ranking', type: ui.FieldType.TEXT, label: 'Ranking'});
            sublist.addField({id: 'custpage_item', type: ui.FieldType.TEXT, label: 'Item Name'});
            sublist.addField({id: 'custpage_vendor', type: ui.FieldType.TEXT, label: 'Vendor'});
            sublist.addField({id: 'custpage_vendorid', type: ui.FieldType.TEXT, label: 'Vendor ID'})
                .updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});
            sublist.addField({id: 'custpage_qa', type: ui.FieldType.TEXT, label: 'QA Approved'});
            sublist.addField({id: 'custpage_country', type: ui.FieldType.TEXT, label: 'Country of Origin'});
            sublist.addField({id: 'custpage_canquote', type: ui.FieldType.TEXT, label: 'CAN QUOTE'});

            // Hidden field to store internal Item ID
            sublist.addField({
                id: 'custpage_itemid',
                type: ui.FieldType.TEXT,
                label: 'Item ID'
            }).updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN});

            // Execute search to populate sublist
            const searchObj = search.create({
                type: "customrecord4905",
                filters: [["custrecord406", "anyof", itemID]],
                columns: [
                    search.createColumn({name: "custrecord701", label: "Purchasing Note"}),
                    search.createColumn({name: "name", label: "ID"}),
                    search.createColumn({name: "custrecord688", label: "IMP / DOM"}),
                    search.createColumn({name: "custrecord722", label: "MOQ"}),
                    search.createColumn({name: "custrecord686", label: "Ranking"}),
                    search.createColumn({name: "custitem7", join: "custrecord406", label: "Full Name"}),
                    search.createColumn({name: "custrecord406", label: "Item ID"}),
                    search.createColumn({name: "custrecord407", label: "Vendor"}),
                    search.createColumn({name: "custrecord412", label: "QA Approved"}),
                    search.createColumn({name: "custrecord685", label: "Country of Origin"}),
                    search.createColumn({name: "custrecord414", label: "DONT QUOTE"}),
                    search.createColumn({name: "custrecord413", label: "CAN QUOTE"})
                ]
            });

            let line = 0;
            searchObj.run().each(result => {
                safeSetSublistValue(sublist, 'custpage_id', line, result.getValue("name"));
                safeSetSublistValue(sublist, 'custpage_note', line, result.getValue("custrecord701"));
                safeSetSublistValue(sublist, 'custpage_impdom', line, result.getText("custrecord688"));
                safeSetSublistValue(sublist, 'custpage_moq', line, result.getValue("custrecord722"));
                safeSetSublistValue(sublist, 'custpage_ranking', line, result.getText("custrecord686"));
                safeSetSublistValue(sublist, 'custpage_item', line, result.getValue({
                    name: 'custitem7',
                    join: 'custrecord406'
                }));
                safeSetSublistValue(sublist, 'custpage_itemid', line, result.getValue("custrecord406")); // Hidden Item ID
                safeSetSublistValue(sublist, 'custpage_vendor', line, result.getText("custrecord407"));
                safeSetSublistValue(sublist, 'custpage_vendorid', line, result.getValue("custrecord407"));
                safeSetSublistValue(sublist, 'custpage_qa', line, result.getValue("custrecord412"));
                safeSetSublistValue(sublist, 'custpage_country', line, result.getValue("custrecord685"));
                safeSetSublistValue(sublist, 'custpage_dontquote', line, result.getValue("custrecord414"));
                safeSetSublistValue(sublist, 'custpage_canquote', line, result.getValue("custrecord413"));
                line++;
                return true;
            });
        }

        /**
         * Processes the selected rows when the user submits the Suitelet.
         * Creates a custom record for each selected row.
         * @param {ServerRequest} request - The Suitelet request object
         * @returns {string[]} - Array of created record IDs
         */
        function processSelectedRows(request) {
            const recordId = request.parameters.custpage_hidden_recordid;
            const lineCount = request.getLineCount({group: 'custpage_result_sublist'});
            const createdRecords = [];

            for (let i = 0; i < lineCount; i++) {
                const checked = request.getSublistValue({
                    group: 'custpage_result_sublist',
                    name: 'custpage_select',
                    line: i
                });

                if (checked === 'T') {
                    const vendorId = request.getSublistValue({
                        group: 'custpage_result_sublist',
                        name: 'custpage_vendorid',
                        line: i
                    });

                    const itemId = request.getSublistValue({
                        group: 'custpage_result_sublist',
                        name: 'custpage_itemid', // hidden internal Item ID
                        line: i
                    });

                    // Create the custom record
                    const rec = record.create({
                        type: 'customrecord4735',
                        isDynamic: true
                    });

                    rec.setValue({fieldId: 'custrecord200', value: recordId});
                    rec.setValue({fieldId: 'custrecord186', value: vendorId});
                    rec.setValue({fieldId: 'custrecord188', value: itemId});

                    // Set dates
                    const today = new Date();
                    const datePlus5 = new Date(today);
                    datePlus5.setDate(today.getDate() + 5);
                    const datePlus3 = new Date(today);
                    datePlus3.setDate(today.getDate() + 3);

                    rec.setValue({fieldId: 'custrecord_hbno_due_date_first_quote', value: datePlus5});
                    rec.setValue({fieldId: 'custrecord401', value: datePlus3});

                    const newId = rec.save();
                    createdRecords.push(newId);

                    log.audit('Created customrecord4735', {newId, vendorId, recordId});
                }
            }

            return createdRecords;
        }

        /**
         * Main entry point for the Suitelet.
         * @param {Object} context - Suitelet context object
         * @param {ServerRequest} context.request - Suitelet request
         * @param {ServerResponse} context.response - Suitelet response
         */
        const onRequest = (context) => {
            try {
                if (context.request.method === 'GET') {
                    const recordId = context.request.parameters.recordId;
                    const recordType = context.request.parameters.recordType;

                    // Lookup item ID from parent record
                    const itemField = search.lookupFields({
                        type: recordType,
                        id: recordId,
                        columns: ['custrecord196']
                    });
                    const itemID = itemField.custrecord196?.[0]?.value;

                    // Create form and remove toolbar
                    const form = ui.createForm({title: 'Select Options'});
                    form.hideNavBar = true; // Remove toolbar

                    buildSublist(form, itemID);

                    // Hidden field to store parent record ID
                    form.addField({
                        id: 'custpage_hidden_recordid',
                        type: ui.FieldType.TEXT,
                        label: 'Record ID'
                    }).updateDisplayType({displayType: ui.FieldDisplayType.HIDDEN}).defaultValue = recordId;

                    form.addSubmitButton({label: 'Submit'});
                    context.response.writePage(form);

                } else if (context.request.method === 'POST') {
                    const createdRecords = processSelectedRows(context.request);

                    // Show confirmation and refresh parent
                    context.response.write(`
                    <script>
                        alert('Created records: ${createdRecords.join(', ')}');
                        if (window.opener) {
                            window.opener.location.reload();
                            window.close();
                        } else {
                            window.location.reload();
                        }
                    </script>
                `);
                }
            } catch (e) {
                log.error('Suitelet Error', e);
                context.response.write(`<script>alert('Error: ${e.message}');</script>`);
            }
        };

        return {onRequest};
    });