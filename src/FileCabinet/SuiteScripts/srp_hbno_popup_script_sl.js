/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/record', 'N/log','N/search', 'N/http', 'N/redirect', 'N/url', '../common/hbno_global_constants'],
    function(serverWidget, record, log, search, http, redirect, url, Constants) {

        const {
            COMMON,
            API_METHODS,
            SUITELET_SCRIPT,
            PRINTERS_RECORD,
            LABELS_RECORD,
            LABEL_MAPPING_RECORD,
            SHIPPING_LABEL_DATA_RECORD,
            HAZARD_STATEMENTS_IDS,
            PRECAUTIONARY_STATEMENTS_IDS
        } = Constants;

        const onRequest = (context) => {

            const { request, response } = context;
            const { parameters } = request;

            if (request.method === 'GET') {

                // Get parameters from the request
                const recordId = parameters.recordId;
                const recordType = parameters.recordType;
                const dataRecordId = parameters.recId;

                // let recordtypeSearch;

                // switch (recordType) {
                //     case 'purchaseorder':
                //         recordtypeSearch = 4;
                //         break;
                // }

                const form = serverWidget.createForm({
                    title: 'Shipping Label Print',
                    hideNavBar: true
                });

                let fieldGroup = form.addFieldGroup({
                    id: 'custpage_fieldgroup',
                    label: 'Label & Printer Fields'
                });

                fieldGroup.isBorderHidden = true;
                log.debug('recordType',recordType)

                if(recordType == 'itemreceipt'){
                    ///////////////item field//////////////
                    let itemField = form.addField({
                        id: 'custpage_items',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Items',
                        container: 'custpage_fieldgroup'
                    });
                    itemField.isMandatory = true;

                    itemField.addSelectOption({
                        value: '',
                        text: ''
                    });

                    let items = getItems(recordId);
                    items.forEach((label) => {
                        itemField.addSelectOption({
                            value: label.value,
                            text: label.text
                        });
                    });

                }

                let labelfield;



                if(recordType == 'customrecord4749'){
                    ///////////////preship record//////////////
                    labelfield = form.addField({
                        id: 'custpage_label',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Label',
                        // source: LABELS_RECORD.RECORD_TYPE,
                        container: 'custpage_fieldgroup'
                    });
                    labelfield.isMandatory = true;

                    // labelfield.removeSelectOption({ value: null, });
                    labelfield.addSelectOption({
                        value: '',
                        text: ''
                    });
                    labelfield.addSelectOption({
                        value: 8,
                        text: 'HBNO Sample Labels- Pre-Ship sample Packaging.lab'
                    });
                    labelfield.addSelectOption({
                        value: 9,
                        text: 'HBNO Sample Labels- Pre-Ship sample.lab'
                    });




                }else{
                    labelfield = form.addField({
                        id: 'custpage_label',
                        type: serverWidget.FieldType.SELECT,
                        label: 'Label',
                        source: LABELS_RECORD.RECORD_TYPE,
                        container: 'custpage_fieldgroup'
                    });
                    labelfield.isMandatory = true;
                }





                let printerField = form.addField({
                    id: 'custpage_printer',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Printer',
                    source: PRINTERS_RECORD.RECORD_TYPE,
                    container: 'custpage_fieldgroup'
                });


                printerField.isMandatory = true;

                printerField.defaultValue = 1;



                let lotNofield = form.addField({
                    id: 'custpage_lot_number',
                    type: serverWidget.FieldType.SELECT,
                    label: 'Lot Number',
                    container: 'custpage_fieldgroup'
                });
                lotNofield.isMandatory = true;

                lotNofield.addSelectOption({
                    value: '',
                    text: ''
                });
                let lotNumbers = getItemLotNumbers(recordId);
                log.debug('lotNumbers',lotNumbers)

                lotNumbers.forEach((label) => {
                    lotNofield.addSelectOption({
                        value: label.value,
                        text: label.text
                    });
                });

                let unitsField = form.addField({
                    id: 'custpage_units',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Units',
                    container: 'custpage_fieldgroup'
                }).updateDisplaySize({
                    height : 60,
                    width : 30
                });
                unitsField.isMandatory = true;

                let tareWeightField = form.addField({
                    id: 'custpage_tare_weight',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Tare Weight',
                    container: 'custpage_fieldgroup'
                }).updateDisplaySize({
                    height : 60,
                    width : 30
                });


                let grossWeightField = form.addField({
                    id: 'custpage_gross_weight',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Gross Weight',
                    container: 'custpage_fieldgroup'
                }).updateDisplaySize({
                    height : 60,
                    width : 30
                });

                let quantityField = form.addField({
                    id: 'custpage_quantity',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Quantity',
                    // source: LABELS_RECORD.RECORD_TYPE,
                    container: 'custpage_fieldgroup'
                }).updateDisplaySize({
                    height : 60,
                    width : 30
                });
                quantityField.isMandatory = true;


                let recordIdField = form.addField({
                    id: 'custpage_record_id',
                    type: serverWidget.FieldType.TEXT,
                    label: 'ID',
                    container: 'custpage_fieldgroup'
                });
                recordIdField.defaultValue = recordId;

                recordIdField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

                let recordTypeField = form.addField({
                    id: 'custpage_record_type',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Record Type',
                    container: 'custpage_fieldgroup'
                });
                recordTypeField.defaultValue = recordType;
                recordTypeField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

                let imageField = form.addField({
                    id: 'custpage_job_image',
                    type: serverWidget.FieldType.INLINEHTML,
                    label: 'Label Image',
                    container: 'custpage_fieldgroup'
                });
                imageField.updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });

                // Add a Submit button
                form.addSubmitButton({
                    label: 'Print'
                });

                if(dataRecordId){
                    log.debug('dataRecordId',dataRecordId)

                    const obj = getDataRecord(dataRecordId);
                    log.debug('obj',obj)

                    labelfield.defaultValue = obj.label;
                    printerField.defaultValue = obj.printer;

                    let fileBase64 = obj.response;

                    // log.debug('fileBase64', fileBase64);

                    imageField.defaultValue = '<img src="data:image/jpg;base64,' + fileBase64 + '" alt="Image"/>';
                    imageField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.NORMAL
                    });

                    // hide these fields
                    lotNofield.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    unitsField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    grossWeightField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    tareWeightField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });
                    quantityField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    let size = getLabelSize(obj.label);
                    let dimensions = size.toString().split('x');
                    log.debug('dimensions', dimensions);
                    let width = dimensions[0].toString().trim();
                    let height = dimensions[1].toString().trim();

                    // add button for generating PDF
                    form.addButton({
                        id: 'custpage_getPdf',
                        label: 'Generate PDF',
                        functionName: `generatePdf(${dataRecordId}, ${width}, ${height})`
                    });

                    form.addButton({
                        id: 'custpage_getImage',
                        label: 'Generate Image',
                        functionName: `generateImage(${dataRecordId})`
                    });
                }

                form.clientScriptModulePath = '../client/srp_hbno_popup_suitelet_script_cs.js';
                // Render the form
                response.writePage(form);
            } else {

                let labelId = parameters.custpage_label;
                let printerId = parameters.custpage_printer;
                let recordId = parameters.custpage_record_id;
                let recordType = parameters.custpage_record_type;
                let lotNo = parameters.custpage_lot_number;
                let grossWeight = parameters.custpage_gross_weight;
                let tareWeight = parameters.custpage_tare_weight;
                let units = parameters.custpage_units;
                let quantity = parameters.custpage_quantity;
                let netWeight = (parseFloat(grossWeight) - parseFloat(tareWeight)).toString();
                let bodyValues=[];
                log.debug('recordType',recordType)
                if(recordType == 'itemreceipt'){
                    let item = parameters.custpage_items;

                    bodyValues=getBodyFields(recordId);
                    log.debug('body values',bodyValues);

                    recordId = item;
                    recordType = getRecordType(recordId);
                }

                if(recordType == 'workorder'){
                    recordId = getWOItem(recordId);
                    recordType = getRecordType(recordId);
                }

                if(recordType == 'customrecord4749'){
                    bodyValues=preshipBodyFields(recordId);
                    recordId = getPreshipItem(recordId);
                    recordType = getRecordType(recordId);
                }

                let obj = getLabelMapping(labelId);

                const currentTimeStamp = new Date().valueOf();
                const fileName = `Test_${currentTimeStamp}.jpg`;

                if (Object.keys(obj).length > 0) {

                    let fieldIds = Object.values(obj);

                    fieldIds = fieldIds.join(",");

                    obj = getFieldValues(obj, recordType, recordId, fieldIds);

                    obj['@LABEL_NAME'] = getLabelName(labelId);
                    obj['@PRINTER_NAME'] = getPrinterName(printerId);
                    obj['@PRINT_IMAGE'] = fileName;
                    obj['@JOB_NAME'] = "TEST JOB";

                    if(labelId == 2){
                        obj['GROSS_WEIGHT'] = grossWeight;
                        obj['TARE_WEIGHT'] = tareWeight;
                        obj['NET_WEIGHT'] = netWeight;
                        obj['LOT_NO'] = lotNo;
                    }

                    if(labelId == 3){

                        let {hazardStmts, precautionaryStmts} = getItemRecordStmts(recordId);

                        log.debug('hazardStatements', hazardStmts);
                        log.debug('precautionaryStatements', precautionaryStmts);

                        obj['HAZARD_STMT'] = hazardStmts;
                        obj['PRECAUTION_STMT'] = precautionaryStmts;
                    }

                    if(labelId == 4){
                        obj['UNITS'] = units;
                        obj['LOT_NO'] = lotNo;
                    }

                    if(labelId == 5 || labelId == 10 ){
                        obj['LOT_NO'] = lotNo;
                    }
                    if( labelId == 7){
                        obj['LOT_NO'] = lotNo;
                        if(bodyValues.length>0){
                            let firstValue = bodyValues[0];
                            obj['Vendor'] = firstValue.vendor;
                            obj['PO_NUMBER'] = firstValue.poNumber;
                            obj['Dates'] = firstValue.trandate;
                        }

                    }
                    if( labelId == 8 || labelId == 9){

                        if(labelId == 8){ obj['QUANTITY'] =quantity;}
                        if(bodyValues.length>0){
                            let firstValue = bodyValues[0];
                            obj['LOT_NO'] = firstValue.lotNo;
                            obj['Vendor'] = firstValue.vendor;
                            obj['Dates'] = firstValue.Dates;
                        }

                    }


                    log.debug('obj', obj);
                }

                const jobId = postJob(obj);

                log.debug('jobId', jobId);

                let status = getJobStatus(jobId);
                log.debug('status', status);
                log.debug('1122', '111');
                let i = 0;
                while(status !== 'Completed'){
                    status = getJobStatus(jobId);
                    i++;
                    log.debug('i',i)
                }
                log.debug('status222', status);

                const blob = getJobFile(jobId, fileName);

                log.debug('blob', blob);

                const recId = createDataRecord(jobId, labelId, printerId, blob);

                log.debug('recId', recId);

                // response.write('Fields submitted successfully!', obj);

                const params = {
                    recordId: recordId,
                    recordType: recordType,
                    recId: recId
                };

                const suiteletURL = url.resolveScript({
                    scriptId: SUITELET_SCRIPT.SCRIPT_ID,
                    deploymentId: SUITELET_SCRIPT.DEPLOYMENT_ID,
                    params: params
                });
                redirect.redirect({ url: suiteletURL });
            }
        }

        // async function waitForJobCompletion(jobId) {
        //     log.debug('jobId', jobId);
        //     return new Promise((resolve) => {
        //       let interval = setInterval(async () => {
        //         log.debug('starting setInterval');
        //         let status = await getJobStatus(jobId); // Assuming getJobStatus is an async function
        //         log.debug('status', status);
        //         if (status === 'Completed') {
        //           clearInterval(interval);
        //           resolve(); // Resolve the promise when the status is "Completed"
        //         }
        //       }, 2000);
        //     });
        // }

        const getRecordItems = (recordType, recordId) => {
            let items = [];
            const searchObj = search.create({
                type: recordType,
                filters: [
                    [COMMON.INTERNAL_ID, COMMON.SEARCH.ANY_OF, recordId],
                    COMMON.SEARCH.AND,
                    [COMMON.SEARCH.MAINLINE, COMMON.SEARCH.IS, COMMON.SEARCH.FALSE]
                ],
                columns: [
                    COMMON.ITEM,
                    COMMON.QUANTITY
                ]
            });

            searchObj.run().each((result) => {
                const id = result.getValue({ name: COMMON.ITEM });
                const quantity = result.getValue({ name: COMMON.QUANTITY });
                items.push({id: id, quantity: quantity});
                return true;
            });
            return items;
        }

        const getItemLabels = (recordId) => {
            let values = [];
            const searchObj = search.create({
                type: LABELS_RECORD.RECORD_TYPE,
                filters: [
                    [`${LABELS_RECORD.TYPE}.${COMMON.INTERNAL_ID}`, COMMON.SEARCH.ANY_OF, recordId]
                ],
                columns: [
                    COMMON.INTERNAL_ID,
                    COMMON.NAME
                ]
            });

            searchObj.run().each((result) => {
                const internalId = result.getValue({ name: COMMON.INTERNAL_ID });
                const name = result.getValue({ name: COMMON.NAME });
                values.push({value: internalId, text: name});
                return true;
            });
            return values;
        }

        const getItemLotNumbers = (recordId) => {
            const values = [];
            const searchObj = search.create({
                type: COMMON.ITEM,
                filters: [
                    [COMMON.INTERNAL_ID, COMMON.SEARCH.ANY_OF, recordId],
                    COMMON.SEARCH.AND,
                    ["inventorynumber.isonhand", COMMON.SEARCH.IS, COMMON.SEARCH.TRUE],
                    // COMMON.SEARCH.AND,
                    // ["inventorynumber.quantityavailable", COMMON.SEARCH.GREATER_THAN, "0"]
                ],
                columns: [
                    COMMON.SERIAL_NO
                ]
            });

            const pageSize = 100; // Page size is 1000
            const pagedData = searchObj.runPaged({ pageSize });

            let totalFetched = 0; // Counter for total fetched rows
            const maxResults = 100; // Limit to 1000 results

            for (let pageIndex = 0; pageIndex < pagedData.pageRanges.length; pageIndex++) {
                const currentPage = pagedData.fetch({ index: pageIndex });

                for (let result of currentPage.data) {
                    if (totalFetched >= maxResults) break; // Stop if 1000 rows are fetched

                    const lotNo = result.getValue({ name: COMMON.SERIAL_NO });
                    values.push({ value: lotNo, text: lotNo });
                    totalFetched++;
                }

                if (totalFetched >= maxResults) break; // Stop pagination after fetching 1000 rows
            }

            return values;
        };

        const getItems = (recordId) => {
            let values = [];
            let searchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","ItemRcpt"],
                        "AND",
                        ["quantity","isnotempty","0"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["internalid","anyof",recordId]
                    ],
                columns:
                    [
                        "item",
                        search.createColumn({
                            name: "itemid",
                            join: "item"
                        })
                    ]
            });

            searchObj.run().each((result) => {
                const item = result.getValue({ name: "item" });
                const itemText = result.getValue({ name: "itemid", join: "item" });
                values.push({value: item, text: itemText});
                return true;
            });
            return values;
        }

        const getWOItem = (recordId) => {
            let values = [];
            const transactionSearchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","WorkOrd"],
                        "AND",
                        ["mainline","is","T"],
                        "AND",
                        ["internalid","anyof",recordId]
                    ],
                columns:
                    [
                        "item"
                    ]
            });

            transactionSearchObj.run().each((result) => {
                const item = result.getValue({ name: "item" });
                values = item;
                return true;
            });

            return values;
        }
        const getPreshipItem = (recordId) => {
            let values = [];
            const customrecord4749SearchObj = search.create({
                type: "customrecord4749",
                filters:
                    [
                        ["internalid","anyof",recordId]
                    ],
                columns:
                    [
                        "custrecord266"
                    ]
            });
            customrecord4749SearchObj.run().each(function(result){
                const item = result.getValue({ name: "custrecord266" });
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

        const getLabelMapping = (labelId) => {
            let obj = {};
            const searchObj = search.create({
                type: LABEL_MAPPING_RECORD.RECORD_TYPE,
                filters:
                    [
                        [LABEL_MAPPING_RECORD.LABEL, COMMON.SEARCH.ANY_OF, labelId]
                    ],
                columns:
                    [
                        search.createColumn({name: COMMON.NAME}),
                        search.createColumn({name: LABEL_MAPPING_RECORD.INTERNAL_ID})
                    ]
            });

            // const searchResultCount = searchObj.runPaged().count;
            // log.debug('searchResultCount:', searchResultCount);
            searchObj.run().each((result) => {
                let key = result.getValue({name: COMMON.NAME});
                let internalId = result.getValue({name: LABEL_MAPPING_RECORD.INTERNAL_ID});
                obj[key] = internalId;
                return true;
            });

            return obj;
        }

        const placeValueInObj = (obj, fieldId, value) => {
            Object.keys(obj).forEach((key) => {
                if(obj[key] == fieldId){
                    obj[key] = value;
                }
            })
            return obj;
        }

        const getFieldValues = (obj, recordType, recordId, fieldIds) => {
            const transactionSearchObj = search.create({
                type: recordType,
                filters: [
                    [COMMON.INTERNAL_ID, COMMON.SEARCH.ANY_OF, recordId]
                ],
                columns: fieldIds.split(',').map((fieldId) => {
                    return search.createColumn({ name: fieldId.trim() });
                })
            });

            // Iterate through the search results
            // const transactionSearchResultCount = transactionSearchObj.runPaged().count;
            // log.debug('searchResultCount:', transactionSearchResultCount);
            transactionSearchObj.run().each((result) => {
                // Iterate through each column in fieldIds
                fieldIds.split(',').forEach((fieldId) => {

                    let value = parseValue(fieldId.trim(), result);

                    obj = placeValueInObj(obj, fieldId, value);
                });
            });
            return obj;
        }

        const getPrinterName = (id) => {
            return getNameFieldValue(PRINTERS_RECORD.RECORD_TYPE, id);
        }

        const getLabelName = (id) => {
            return getNameFieldValue(LABELS_RECORD.RECORD_TYPE, id);
        }

        const getNameFieldValue = (type, id) => {
            let fieldLookUp = search.lookupFields({
                type: type,
                id: id,
                columns: [COMMON.NAME]
            });

            return fieldLookUp[COMMON.NAME]
        }

        const getLabelSize = (id) => {
            let fieldLookUp = search.lookupFields({
                type: LABELS_RECORD.RECORD_TYPE,
                id: id,
                columns: [LABELS_RECORD.SIZE]
            });

            return fieldLookUp[LABELS_RECORD.SIZE]
        }

        const createDataRecord = (jobId, labelId, printerId, response) => {
            const rec = record.create({
                type: SHIPPING_LABEL_DATA_RECORD.RECORD_TYPE
            });
            rec.setValue({fieldId: SHIPPING_LABEL_DATA_RECORD.JOB_ID, value: jobId});
            rec.setValue({fieldId: SHIPPING_LABEL_DATA_RECORD.LABEL, value: labelId});
            rec.setValue({fieldId: SHIPPING_LABEL_DATA_RECORD.PRINTER, value: printerId});
            rec.setValue({fieldId: SHIPPING_LABEL_DATA_RECORD.RESPONSE, value: response});
            const id = rec.save();
            return id;
        }

        const getDataRecord = (id) => {

            let values = [];
            const searchObj = search.create({
                type: SHIPPING_LABEL_DATA_RECORD.RECORD_TYPE,
                filters: [
                    [COMMON.INTERNAL_ID, COMMON.SEARCH.ANY_OF, id]
                ],
                columns: [
                    SHIPPING_LABEL_DATA_RECORD.JOB_ID,
                    SHIPPING_LABEL_DATA_RECORD.LABEL,
                    SHIPPING_LABEL_DATA_RECORD.PRINTER,
                    SHIPPING_LABEL_DATA_RECORD.RESPONSE
                ]
            });

            searchObj.run().each((result) => {
                const jobId = result.getValue({ name: SHIPPING_LABEL_DATA_RECORD.JOB_ID });
                const label = result.getValue({ name: SHIPPING_LABEL_DATA_RECORD.LABEL });
                const printer = result.getValue({ name: SHIPPING_LABEL_DATA_RECORD.PRINTER });
                const resp = result.getValue({ name: SHIPPING_LABEL_DATA_RECORD.RESPONSE });
                values.push({jobId: jobId, label: label, printer: printer, response: resp});
                return true;
            });
            return values.length ? values[0] : null;
        }

        const getItemRecordStmts = (itemId) => {
            const itemRecord = record.load({
                type: search.lookupFields({
                    type: COMMON.ITEM,
                    id: itemId,
                    columns: ['recordtype']
                })
                    ['recordtype'],
                id: itemId
            });

            let hazardStmts = getHazardStatements(itemRecord);
            let precautionaryStmts = getPrecautionaryStatements(itemRecord);

            return {hazardStmts, precautionaryStmts};
        }

        const getHazardStatements = (itemRecord) => {
            let str = '';

            // Loop through the hazard statement field IDs
            Object.values(HAZARD_STATEMENTS_IDS).forEach((fieldId) => {

                const fieldValue = itemRecord.getValue({ fieldId: fieldId });
                // Get the field object using the field ID
                if(fieldValue === true){
                    const field = itemRecord.getField({ fieldId: fieldId });

                    const fieldName = field.label;

                    if (fieldName) {
                        str += `${fieldName}\n`;
                    }
                }
            });

            return str;
        };

        const getPrecautionaryStatements = (itemRecord) => {
            let str = '';

            // Loop through the hazard statement field IDs
            Object.values(PRECAUTIONARY_STATEMENTS_IDS).forEach((fieldId) => {

                const fieldValue = itemRecord.getValue({ fieldId: fieldId });
                // Get the field object using the field ID
                if(fieldValue === true){
                    const field = itemRecord.getField({ fieldId: fieldId });
                    const fieldName = field.label;
                    if (fieldName) {
                        str += `${fieldName}\n`;
                    }
                }
            });

            return str;
        };

        const postJob = (obj) => {

            const headers = {
                'Content-Type': 'application/json',
                'Connection': 'keep-alive',
            };
log.audit('API_METHODS.JOBS',API_METHODS.JOBS)
            const response = http.post({
                url: API_METHODS.JOBS,
                headers: headers,
                body: JSON.stringify([obj])
            });

            log.debug('response', response);

            let result = JSON.parse(response.body);

            log.debug('result', result);

            return result.id;
        }

        const getJobStatus = (id) => {

            log.debug('id',id)
            log.debug('`${API_METHODS.JOBS}/${id}`',`${API_METHODS.JOBS}/${id}`)
            const response = http.get({
                url: `${API_METHODS.JOBS}/${id}`
            });
            log.debug('response',response)

            let result = JSON.parse(response.body);

            // log.debug('getJobStatus result', result);

            return result.status;
        }

        const getJobFile = (id, name) => {

            const response = http.get({
                url: `${API_METHODS.FILES}/${id}/${name}/attachment`
            });

            // log.debug('response', response);

            return response.body;
        }

        const parseValue = (internalId, result) => {
            let text = result.getValue({name: internalId});
            if(internalId === COMMON.CUSTOMER || internalId === COMMON.SUBSIDIARY || internalId === 'class'){
                text = result.getText({name: internalId});
                text = text.split(':')[text.split(':').length-1];
            }
            return text.trim();
        };

        const getBodyFields=(internalId)=>{
            log.debug('body feild detail','recordid '+internalId);
            let values=[];
            let transactionSearchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["internalid","anyof",internalId],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        "entity",
                        "createdfrom",
                        "trandate"
                    ]
            });let searchResult = transactionSearchObj.run().getRange({
                start: 0,
                end: 1000
            });
            log.debug('save search length', searchResult.length);
            if(searchResult.length){
                let vendor = searchResult[0].getText({
                    name: "entity"
                }); log.debug('vendor Value', vendor);

                let poNumber = searchResult[0].getText({
                    name: "createdfrom"
                }); log.debug('poNumber Value', poNumber);

                let trandate = searchResult[0].getValue({
                    name: "trandate"
                }); log.debug('trandate Value', trandate);

                poNumber=poNumber.split('#');
                poNumber=poNumber[1];

                values.push({vendor:vendor,poNumber:poNumber,trandate:trandate});
                log.debug('values ',values);

            }

            return values;


        }
        const preshipBodyFields=(internalId)=>{
            log.debug('body feild detail','recordid '+internalId);
            let values=[];
            var customrecord4749SearchObj = search.create({
                type: "customrecord4749",
                filters:
                    [
                        ["internalid","anyof",internalId]
                    ],
                columns:
                    [
                        "custrecord265",
                        "custrecord270",
                        "custrecord271"
                    ]
            });
            var searchResultCount = customrecord4749SearchObj.runPaged().count;
            log.debug("customrecord4749SearchObj result count",searchResultCount);
            customrecord4749SearchObj.run().each(function(result){
                let vendor = result.getText({
                    name: 'custrecord265'
                });log.debug('vendor value',vendor);

                let Dates = result.getValue({
                    name: 'custrecord270'
                });log.debug('Date value',Dates);

                let lotNo = result.getValue({
                    name: 'custrecord271'
                });log.debug('lotNo value',lotNo);

                values.push({vendor:vendor,Dates:Dates,lotNo:lotNo});


                return true;
            });

            return values;


        }

        return {
            onRequest
        };
    });
