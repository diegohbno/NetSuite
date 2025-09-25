/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/http', 'N/record', 'N/search', 'N/file'],
    (http, record, search, file) => {

        const afterSubmit = (context) => {
            try {
                if (context.type !== context.UserEventType.CREATE &&
                    context.type !== context.UserEventType.EDIT) {
                    return;
                }

                const newRecord = context.newRecord;
                const oldRec = context.oldRecord;

                const newStatus = newRecord.getValue('orderstatus'); // Work Order status
                const oldStatus = oldRec ? oldRec.getValue('orderstatus') : null;
                const currentTimeStamp = new Date().valueOf();
                const fileName = `Test_${currentTimeStamp}.pdf`;

                // Released = 'B' (en NetSuite los Work Orders usan A=Planned, B=Released, etc.)
                // if (newStatus === 'B' && newStatus !== oldStatus) {
                log.debug('Status change', `WO ${newRecord.id} changed to Released`);
                let obj = getLabelMapping(10);

                recordId = getWOItem(newRecord.id);
                recordType = getRecordType(newRecord.id);
                /*      obj['@LABEL_NAME'] = getLabelName(10);
                   obj['@PRINT_PDF'] =fileName;
                   obj['@PRINTER_NAME'] =getPrinterName(1);
                   obj['@PARTNUM'] ="11";
                   obj['@LotNum'] ="12345";
                   obj['@NAME'] ="JEEP";
                   obj['@SCALE'] ="1/750";
                   obj['@UnitsPerBx'] = "100";
                   obj['@LogoName'] = "Jeep.bpm";
                   obj['@LABELQUANTITY'] = "1";*/

                log.debug('obj', obj);

                obj['@LABEL_NAME'] = getLabelName(10);
                obj['@PRINTER_NAME'] = getPrinterName(1);
                obj['@PRINT_PDF'] = fileName;
                obj['@JOB_NAME'] = "TEST JOB";
                obj['LOT_NO'] = newRecord.getValue('custbody360');


                const jobId = postJob(obj);

                log.debug('jobId', jobId);

                let status = getJobStatus(jobId);
                log.debug('status', status);
                log.debug('1122', '111');
                let i = 0;
                while (status !== 'Completed') {
                    status = getJobStatus(jobId);
                    i++;
                    log.debug('i', i)
                }
                log.debug('status222', status);

                const blob = getJobFile(jobId, fileName);

                log.debug('blob', blob);
                let fileID = saveBlobAsPdf(newRecord, blob)
                // Guardar resultado en el campo custbody_hbno_fnsku
                record.submitFields({
                    type: newRecord.type,
                    id: newRecord.id,
                    values: {
                        custbody_hbno_fnsku: fileID
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

            } catch (e) {
                log.error('afterSubmit error', e);
            }
        };

        const getLabelMapping = (labelId) => {
            let obj = {};
            const searchObj = search.create({
                type: 'customrecord_srp_hbno_label_mapping_rec',
                filters:
                    [
                        ['custrecord_srp_hbno_label_map_label', 'anyof', labelId]
                    ],
                columns:
                    [
                        search.createColumn({name: 'name'}),
                        search.createColumn({name: 'custrecord_srp_hbno_label_map_internalid'})
                    ]
            });

            // const searchResultCount = searchObj.runPaged().count;
            // log.debug('searchResultCount:', searchResultCount);
            searchObj.run().each((result) => {
                let key = result.getValue({name: 'name'});
                let internalId = result.getValue({name: 'custrecord_srp_hbno_label_map_internalid'});
                obj[key] = internalId;
                return true;
            });


            return obj;
        }

        const getWOItem = (recordId) => {
            let values = [];
            const transactionSearchObj = search.create({
                type: "transaction",
                settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                filters:
                    [
                        ["type", "anyof", "WorkOrd"],
                        "AND",
                        ["mainline", "is", "T"],
                        "AND",
                        ["internalid", "anyof", recordId]
                    ],
                columns:
                    [
                        "item"
                    ]
            });

            transactionSearchObj.run().each((result) => {
                const item = result.getValue({name: "item"});
                values = item;
                return true;
            });

            return values;
        }

        const getRecordType = (recordId) => {
            const itemRecordType = search.lookupFields({
                type: "item",
                id: recordId,
                columns: ['recordtype']
            })['recordtype'];
            return itemRecordType;
        }

        const postJob = (obj) => {

            const headers = {
                'Content-Type': 'application/json',
                'Connection': 'keep-alive',
            };
            const response = http.post({
                url: 'http://98.81.113.107:5001/api/v1/jobs',
                headers: headers,
                body: JSON.stringify([obj])
            });

            log.debug('response', response);

            let result = JSON.parse(response.body);

            log.debug('result', result);

            return result.id;
        }

        const getPrinterName = (id) => {
            return getNameFieldValue('customrecord_srp_hbno_printers_rec', id);
        }

        const getLabelName = (id) => {
            return getNameFieldValue('customrecord_srp_hbno_labels_rec', id);
        }

        const getNameFieldValue = (type, id) => {
            let fieldLookUp = search.lookupFields({
                type: type,
                id: id,
                columns: ['name']
            });

            return fieldLookUp['name']
        }

        const getJobStatus = (id) => {

            const response = http.get({
                url: `http://98.81.113.107:5001/api/v1/jobs/${id}`
            });
            log.debug('response', response)

            let result = JSON.parse(response.body);

            // log.debug('getJobStatus result', result);

            return result.status;
        }

        const getJobFile = (id, name) => {
            log.debug('http://98.81.113.107:5001/api/v1/files/${id}/${name}/attachment', `http://98.81.113.107:5001/api/v1/files/${id}/${name}/attachment`)

            const response = http.get({
                url: `http://98.81.113.107:5001/api/v1/files/${id}/${name}/attachment`
            });

            // log.debug('response', response);

            return response.body;
        }


        const saveBlobAsPdf = (newRecord, blobContent) => {
            // blobContent sería un string/base64/pdf binario
            const currentTimeStamp = new Date().valueOf();
            const fileName = `Test_${currentTimeStamp}.pdf`;
            const pdfFile = file.create({
                name: fileName,
                fileType: file.Type.PDF,
                contents: blobContent, // puede ser binario/base64
                folder: 811525            // ID de la carpeta en File Cabinet
            });

            const fileId = pdfFile.save();
            log.debug('PDF guardado con ID:', fileId);
            return fileId;
        };

        return {afterSubmit: afterSubmit};
    });
