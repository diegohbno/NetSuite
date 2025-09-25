/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    (record, search, runtime) => {

        /**
         * Lookup the name and email of the employee/author.
         * @param {string|number} authorId - Internal ID of the author.
         * @returns {{name: string|null, email: string|null}} - Employee name and email.
         */
        const getAuthorData = (authorId) => {
            try {
                if (!authorId) return {name: null, email: null};

                const authorData = search.lookupFields({
                    type: 'employee',
                    id: authorId,
                    columns: ['entityid', 'email']
                });

                log.debug('Author lookup result', authorData);

                return {
                    name: authorData.entityid || null,
                    email: authorData.email || null
                };
            } catch (e) {
                log.error('Error looking up author data', e);
                return {name: null, email: null};
            }
        };


        /**
         * Update the custom record with the last email author name, message, and internal/external flag.
         * @param {string} recId - Internal ID of the custom record.
         * @param {string} authorName - Author name from lookup.
         * @param {string} messageText - Body of the email.
         * @param {number} isInternal - True if email ends with @hbno.com.
         */
        const updateCustomRecord = (recId, authorName, messageText, isInternal, recType, newRecord) => {
            try {
                const accountId = runtime.accountId;
                const baseUrl = `https://${accountId}.app.netsuite.com`;
                const emailLink = `${baseUrl}/app/crm/common/crmmessage.nl?id=${newRecord.id}&l=T`;

                if (recType === record.Type.PURCHASE_ORDER) {
                    record.submitFields({
                        type: recType,
                        id: recId,
                        values: {
                            custbody_hbno_last_sender_receive: authorName,
                            custbody_hbno_last_message: stripHtml(messageText),
                            custbody_hbno_last_email_internal: isInternal,
                            custbody_hbno_last_email_date: new Date(),
                            custbody_hbno_last_email_link: emailLink

                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                } else {
                    record.submitFields({
                        type: 'customrecord4735',
                        id: recId,
                        values: {
                            custrecord_hbno_last_sender_receive: authorName,
                            custrecord_hbno_last_message: stripHtml(messageText),
                            custrecord_hbno_last_email_internal_ext: isInternal
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });
                    log.debug('Custom record updated successfully', {recId, authorName});
                }
            } catch (e) {
                log.error('Error updating custom record', e);
            }
        };

        /**
         * AfterSubmit User Event on Message record.
         * Updates the linked custom record with the email author name, message body, and internal/external flag.
         * @param {UserEventContext} context - Script context
         */
        const afterSubmit = (context) => {
            try {
                const newRecord = context.newRecord;
                let recId = newRecord.getValue({fieldId: 'record'});
                let recType = newRecord.getValue({fieldId: 'recordtype'});
                const authorId = newRecord.getValue({fieldId: 'author'});
                let messageText = newRecord.getValue({fieldId: 'message'});
                let transactionID = newRecord.getValue({fieldId: 'transaction'});
                if (transactionID) {
                    let transactionSearchObj = search.create({
                        type: "transaction",
                        filters: [["internalidnumber", "equalto", transactionID],
                            "AND",
                            ["mainline", "is", "T"]]
                    });
                    transactionSearchObj.run().each(function (result) {
                        recType = result.recordType
                    });
                    recId = transactionID;
                }
                let authorName;
                let isInternal = 1;
                authorName = newRecord.getValue({fieldId: 'authoremail'});
                if (authorId) {
                    const {name, email} = getAuthorData(authorId);
                    authorName = name;
                    if (email && email.toLowerCase().endsWith('@hbno.com')) {
                        isInternal = 2;
                    }
                } else if (authorName) {
                    if (authorName && authorName.toLowerCase().endsWith('@hbno.com')) {
                        isInternal = 2;
                    }
                }
                log.debug('recType', recType)
                log.debug('newRecord', newRecord)
                updateCustomRecord(recId, authorName, messageText, isInternal, recType, newRecord);
            } catch
                (e) {
                log.error('Error in afterSubmit (Message UE)', e);
            }
        };


        /**
         * Remove all HTML tags and return plain text.
         * @param {string} htmlString - Raw HTML string.
         * @returns {string} - Clean plain text.
         */
        function stripHtml(htmlString) {
            if (!htmlString) return "";
            return htmlString
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        return {afterSubmit};
    })
;
