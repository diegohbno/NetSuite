/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * @description NetSuite Suitelet for generating shipping labels with hazardous material information.
 * Processes item receipts and generates PDF labels through an external API service.
 *
 * @author Your Name
 * @version 1.0.0
 */
define(['N/search', 'N/render', 'N/file', 'N/http', 'N/record'], function (search, render, file, http, record) {

    // ================================
    // MAIN ENTRY POINT
    // ================================

    /**
     * Main entry point for the Suitelet
     * @param {Object} context - The request context
     * @param {Object} context.request - The HTTP request object
     * @param {Object} context.response - The HTTP response object
     */
    const onRequest = (context) => {
        try {
            log.debug('Suitelet Request', context);
            const parameters = context.request.parameters;

            if (context.request.method === 'GET') {
                handleGetRequest(parameters);
            } else {
                log.error('Unsupported HTTP Method', context.request.method);
                context.response.write('Method not supported');
            }
        } catch (error) {
            log.error('Error in onRequest', error);
            context.response.write(`Error: ${error.message}`);
        }
    };

    /**
     * Handles GET requests and routes to appropriate record type processor
     * @param {Object} parameters - Request parameters
     */
    const handleGetRequest = (parameters) => {
        log.debug('parameters', parameters)
        const recordId = parameters.recordId;
        const recordType = parameters.recordType;
        const dataRecordId = parameters.recId;

        if (!recordId || !recordType) {
            log.error('Missing Parameters', 'recordId and recordType are required');
            return;
        }
        log.debug('recordType.toLowerCase()', recordType.toLowerCase())
        // Switch case for different record types
        switch (recordType.toLowerCase()) {
            case 'itemreceipt':
                processItemReceipt(recordId, dataRecordId);
                break;
            case 'workorder':
                processWorkOrder(recordId, dataRecordId);
                break;

            default:
                log.error('Unsupported Record Type', `Record type '${recordType}' is not supported`);
                break;
        }
    };

    const processWorkOrder = (recordId, dataRecordId) => {


    }
    // ================================
    // RECORD TYPE PROCESSORS
    // ================================

    /**
     * Processes item receipt records for label generation
     * @param {string} recordId - The internal ID of the item receipt record
     * @param {string} dataRecordId - Optional data record ID
     */
    const processItemReceipt = (recordId, dataRecordId) => {
        try {
            log.audit('Processing Item Receipt', `Record ID: ${recordId}`);

            // Get item details from the item receipt
            const items = getItemReceiptItems(recordId);
            log.audit('Retrieved Items', items);

            // Get body field values
            const bodyValues = getItemReceiptBodyFields(recordId);
            log.debug('Body Values', bodyValues);

            // Process each item for label generation
            if (items && items.length > 0) {
                generateLabelsForItems(items, 3, 1, recordId); // labelId = 3, printerId = 1
            } else {
                log.error('No Items Found', `No items found for item receipt ${recordId}`);
            }

        } catch (error) {
            log.error('Error Processing Item Receipt', error);
        }
    };

    /**
     * Generates labels for a collection of items
     * @param {Array} items - Array of item objects
     * @param {number} labelId - The label template ID
     * @param {number} printerId - The printer ID
     */
    const generateLabelsForItems = (items, labelId, printerId, recordId) => {
        try {
            // Get label mapping configuration
            const labelMapping = getLabelMapping(labelId);

            if (Object.keys(labelMapping).length === 0) {
                log.error('No Label Mapping Found', `No mapping found for label ID: ${labelId}`);
                return;
            }

            // Step 1: Map item index to fileID
            const fileIdMap = {};
            // Process each item
            // for (let i = 0; i < 1; i++) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                log.debug('Processing Item', item);

                const labelData = prepareLabelData(item, labelMapping, labelId, printerId);
                let fileID = generateAndSaveLabel(labelData);
                log.debug('fileID', fileID)
                if (fileID)
                    fileIdMap[i] = fileID;


            }
            log.audit('  fileIdMap[i]', fileIdMap)
            log.audit('recordId', recordId)
            // Step 2: Load the record and update each line
            const rec = record.load({
                type: 'itemreceipt', // or your recordType variable
                id: recordId
            });

            //       for (let i = 0; i < 1; i++) {
            for (let i = 0; i <= items.length; i++) {
                if (fileIdMap[i]) {
                    rec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_hbno_label_pdf',
                        line: i,
                        value: fileIdMap[i]
                    });
                }
            }
            let itemID = rec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.debug('itemID', itemID)

        } catch (error) {
            log.error('Error Generating Labels', error);
        }
    };

    /**
     * Prepares label data for a single item
     * @param {Object} item - Item object with properties
     * @param {Object} labelMapping - Label field mapping
     * @param {number} labelId - Label template ID
     * @param {number} printerId - Printer ID
     * @returns {Object} Prepared label data object
     */
    const prepareLabelData = (item, labelMapping, labelId, printerId) => {
        const currentTimeStamp = new Date().valueOf();
        const fileName = `Label_${item.itemid}_${currentTimeStamp}.pdf`;

        // Clone the label mapping to avoid mutation
        const labelData = Object.assign({}, labelMapping);

        // Add system fields
        labelData['@LABEL_NAME'] = getLabelName(labelId);
        labelData['@PRINTER_NAME'] = getPrinterName(printerId);
        labelData['@PRINT_PDF'] = `C:\\Users\\Public\\Documents\\${fileName}`;
        labelData['@JOB_NAME'] = `Label_Job_${item.itemid}`;
        log.audit('item', item)
        log.audit('item.itemName', item.itemName)
        // Add item-specific data
        labelData['FIRE_CLASS'] = item.fireClass || '';
        labelData['FLASH_POINT'] = item.flashPoint || '';
        labelData['SIGNAL_WORD'] = item.signalWord || '';
        labelData['CAS'] = item.cas || '';
        labelData['EC'] = item.ec || '';
        labelData['UN'] = item.unNumber || '';
        labelData['ITEM_NAME'] = item.itemName || '';
        labelData['ITEM_SKU'] = item.itemid || '';

        log.audit('item', item)


        if (item.exclamationMark)
            labelData['EXCLAMATION_MARK'] = "YES";
        if (item.environmentalHazard)
            labelData['ENV_HAZARD'] = "YES";
        if (item.corrosive)
            labelData['CORROSIVE'] = "YES";
        if (item.skullAndCrossbones)
            labelData['SKULLS'] = "YES";
        if (item.healthHazard)
            labelData['PRINT_HAZARD'] = "YES";
        if (item.flame)
            labelData['PRINT_FLAME'] = "YES";
        if(item.organic === "Yes")
            labelData['ORGANIC'] = "YES";
        if(item.fairForLife === "Yes")
            labelData['FAIR_LIFE'] = "YES";
        if(item.kosher === "Yes")
            labelData['EARTHKOSHER'] = "YES";
        if(item.allergen === "Allergen")
            labelData['ALLERGEN_SHOW'] = "YES";




        // Get hazard and precautionary statements
        const {hazardStmts, precautionaryStmts} = getItemHazardStatements(item.item);
        log.audit('hazardStmts', hazardStmts)
        log.audit('precautionaryStmts', precautionaryStmts)
        labelData['HAZARD_STATEMENTS'] = hazardStmts;
        labelData['PRECAUTIONARY_STATEMENTS'] = precautionaryStmts;


        // Store filename for later use
        labelData._fileName = fileName;

        return labelData;
    };

    /**
     * Generates and saves a label through the external API
     * @param {Object} labelData - Prepared label data
     */
    const generateAndSaveLabel = (labelData) => {
        try {
            // Remove internal fields before sending to API
            const fileName = labelData._fileName;
            delete labelData._fileName;

            // Submit job to external API
            const jobId = submitLabelJob(labelData);
            log.debug('Job Submitted', `Job ID: ${jobId}`);

            // Wait for job completion
            waitForJobCompletion(jobId);

            // Retrieve the generated file
            const fileBlob = retrieveJobFile(jobId, fileName);

            // Save file to NetSuite
            const fileId = saveFileToNetSuite(fileName, fileBlob);
            log.audit('File Saved', `File ID: ${fileId}`);
            return fileId;

        } catch (error) {
            log.error('Error Generating Label', error);
        }
    };

    // ================================
    // DATA RETRIEVAL FUNCTIONS
    // ================================

    /**
     * Retrieves items from an item receipt record
     * @param {string} recordId - Internal ID of the item receipt
     * @returns {Array} Array of item objects with properties
     */
    const getItemReceiptItems = (recordId) => {
        const items = [];

        const searchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters: [
                ["type", "anyof", "ItemRcpt"],
                "AND",
                ["quantity", "isnotempty", ""],
                "AND",
                ["mainline", "is", "F"],
                "AND",
                ["taxline", "is", "F"],
                "AND",
                ["internalid", "anyof", recordId]
            ],
            columns: [
                "item",
                search.createColumn({name: "itemid", join: "item"}),
                search.createColumn({name: "custitem_srp_fireclass", join: "item", label: "Fire Class"}),
                search.createColumn({name: "custitem_srp_fp", join: "item", label: "Flash Point"}),
                search.createColumn({name: "custitem_hbno_signal_word", join: "item", label: "Signal Word"}),
                search.createColumn({name: "custitem14", join: "item", label: "CAS"}),
                search.createColumn({name: "custitem59", join: "item", label: "EC"}),
                search.createColumn({name: "custitem7", join: "item", label: "Full Name"}),
                search.createColumn({name: "custitem_srp_unnumber", join: "item", label: "UN Number"}),
                search.createColumn({name: "custitem_srp_skullandcrossbones", join: "item"}),
                search.createColumn({name: "custitem_srp_corrosive", join: "item"}),
                search.createColumn({name: "custitem_srp_environmentalhazard", join: "item"}),
                search.createColumn({name: "custitem_srp_exclamationmark", join: "item"}),
                search.createColumn({name: "custitem_srp_flame", join: "item"}),
                search.createColumn({name: "custitem_srp_healthhazard", join: "item"}),
                search.createColumn({name: "custitem_srp_organic", join: "item"}),
                search.createColumn({name: "custitem_srp_fair_for_life", join: "item"}),
                search.createColumn({name: "custitem_srp_kosher", join: "item"}),
                search.createColumn({name: "custitem_srp_allergen", join: "item"}),


            ]
        });

        const pagedData = searchObj.runPaged({pageSize: 1000});

        pagedData.pageRanges.forEach((pageRange) => {
            const page = pagedData.fetch({index: pageRange.index});
            page.data.forEach((result) => {
                log.debug('result', result)
                items.push({
                    item: result.getValue("item"),
                    itemid: result.getValue({name: "itemid", join: "item"}),
                    itemName: result.getValue({name: "custitem7", join: "item"}),
                    fireClass: result.getValue({name: "custitem_srp_fireclass", join: "item"}),
                    flashPoint: result.getValue({name: "custitem_srp_fp", join: "item"}),
                    signalWord: result.getValue({name: "custitem_hbno_signal_word", join: "item"}),
                    cas: result.getValue({name: "custitem14", join: "item"}),
                    ec: result.getValue({name: "custitem59", join: "item"}),
                    unNumber: result.getValue({name: "custitem_srp_unnumber", join: "item"}),
                    skullAndCrossbones: result.getValue({name: "custitem_srp_skullandcrossbones", join: "item"}),
                    corrosive: result.getValue({name: "custitem_srp_corrosive", join: "item"}),
                    environmentalHazard: result.getValue({name: "custitem_srp_environmentalhazard", join: "item"}),
                    exclamationMark: result.getValue({name: "custitem_srp_exclamationmark", join: "item"}),
                    flame: result.getValue({name: "custitem_srp_flame", join: "item"}),
                    healthHazard: result.getValue({name: "custitem_srp_healthhazard", join: "item"}),
                    organic: result.getText({name: "custitem_srp_organic", join: "item"}),
                    fairForLife: result.getText({name: "custitem_srp_fair_for_life", join: "item"}),
                    kosher: result.getText({name: "custitem_srp_kosher", join: "item"}),
                    allergen: result.getText({name: "custitem_srp_allergen", join: "item"}),
                });
            });
        });


        return items;
    };

    /**
     * Retrieves body field values from an item receipt
     * @param {string} internalId - Internal ID of the item receipt
     * @returns {Array} Array of body field objects
     */
    const getItemReceiptBodyFields = (internalId) => {
        log.debug('Retrieving Body Fields', `Record ID: ${internalId}`);
        const values = [];

        const transactionSearchObj = search.create({
            type: "transaction",
            settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
            filters: [
                ["internalid", "anyof", internalId],
                "AND",
                ["mainline", "is", "T"]
            ],
            columns: [
                "entity",
                "createdfrom",
                "trandate"
            ]
        });

        const searchResult = transactionSearchObj.run().getRange({
            start: 0,
            end: 1000
        });

        log.debug('Search Results Count', searchResult.length);

        if (searchResult.length > 0) {
            const result = searchResult[0];

            const vendor = result.getText({name: "entity"});
            let poNumber = result.getText({name: "createdfrom"});
            const trandate = result.getValue({name: "trandate"});

            // Extract PO number from the full text
            if (poNumber && poNumber.includes('#')) {
                poNumber = poNumber.split('#')[1];
            }

            values.push({
                vendor: vendor,
                poNumber: poNumber,
                trandate: trandate
            });

            log.debug('Body Field Values', values);
        }

        return values;
    };

    /**
     * Gets hazard and precautionary statements for an item
     * @param {string} itemId - Internal ID of the item
     * @returns {Object} Object containing hazardStmts and precautionaryStmts
     */
    const getItemHazardStatements = (itemId) => {
        try {
            log.debug('Retrieving Hazard Statements', `Item ID: ${itemId}`);

            // Get the item's record type
            const itemRecordType = search.lookupFields({
                type: 'item',
                id: itemId,
                columns: ['recordtype']
            })['recordtype'];

            // Load the item record
            const itemRecord = record.load({
                type: itemRecordType,
                id: itemId
            });
            log.debug('itemRecordType', itemRecordType)
            log.debug('itemId', itemId)

            const hazardStmts = extractHazardStatements(itemRecord);
            const precautionaryStmts = extractPrecautionaryStatements(itemRecord);

            log.debug('Hazard Statements Retrieved', {hazardStmts, precautionaryStmts});

            return {hazardStmts, precautionaryStmts};

        } catch (error) {
            log.error('Error Retrieving Hazard Statements', error);
            return {hazardStmts: '', precautionaryStmts: ''};
        }
    };

    // ================================
    // HAZARD STATEMENT EXTRACTION
    // ================================

    /**
     * Extracts hazard statements from an item record
     * @param {Object} itemRecord - NetSuite item record object
     * @returns {string} Concatenated hazard statements
     */
    const extractHazardStatements = (itemRecord) => {
        let statements = '';

        const hazardFields = [
            'custitem_srp_hbno_item_hazard_h226',
            'custitem_srp_hbno_item_hazard_h227',
            'custitem_srp_hbno_item_hazard_h302',
            'custitem_srp_hbno_item_hazard_h303',
            'custitem_srp_hbno_item_hazard_h304',
            'custitem_srp_hbno_item_hazard_h305',
            'custitem_srp_hbno_item_hazard_h310',
            'custitem_srp_hbno_item_hazard_h311',
            'custitem_srp_hbno_item_hazard_h312',
            'custitem_srp_hbno_item_hazard_h313',
            'custitem_srp_hbno_item_hazard_h314',
            'custitem_srp_hbno_item_hazard_h315',
            'custitem_srp_hbno_item_hazard_h316',
            'custitem_srp_hbno_item_hazard_h317',
            'custitem_srp_hbno_item_hazard_h318',
            'custitem_srp_hbno_item_hazard_h319',
            'custitem_srp_hbno_item_hazard_h320',
            'custitem_srp_hbno_item_hazard_h330',
            'custitem_srp_hbno_item_hazard_h332',
            'custitem_srp_hbno_item_hazard_h335',
            'custitem_srp_hbno_item_hazard_h341',
            'custitem_srp_hbno_item_hazard_h350',
            'custitem_srp_hbno_item_hazard_h351',
            'custitem_srp_hbno_item_hazard_h361',
            'custitem_srp_hbno_item_hazard_h371',
            'custitem_srp_hbno_item_hazard_h400',
            'custitem_srp_hbno_item_hazard_h401',
            'custitem_srp_hbno_item_hazard_h402',
            'custitem_srp_hbno_item_hazard_h410',
            'custitem_srp_hbno_item_hazard_h412',
            'custitem_srp_hbno_item_hazard_rsl53',
            'custitem_srp_hbno_item_hazard_r43',
            'custitem_srp_hbno_item_hazard_r41',
            'custitem_srp_hbno_item_hazard_r38'
        ];

        hazardFields.forEach((fieldId) => {
            const fieldValue = itemRecord.getValue({fieldId});


            if (fieldValue === true) {
                const field = itemRecord.getField({fieldId});
                if (field && field.label) {
                    statements += `${field.label}\n`;
                }
            }
        });

        return statements.trim();
    };

    /**
     * Extracts precautionary statements from an item record
     * @param {Object} itemRecord - NetSuite item record object
     * @returns {string} Concatenated precautionary statements
     */
    const extractPrecautionaryStatements = (itemRecord) => {
        let statements = '';

        const precautionFields = [
            'custitem_srp_hbno_item_precau_p101',
            'custitem_srp_hbno_item_precau_p102',
            'custitem_srp_hbno_item_precau_p103',
            'custitem_srp_hbno_item_precau_p201',
            'custitem_srp_hbno_item_precau_p202',
            'custitem_srp_hbno_item_precau_p210',
            'custitem_srp_hbno_item_precau_p261',
            'custitem_srp_hbno_item_precau_p264',
            'custitem_srp_hbno_item_precau_p270',
            'custitem_srp_hbno_item_precau_p271',
            'custitem_srp_hbno_item_precau_p272',
            'custitem_srp_hbno_item_precau_p273',
            'custitem_srp_hbno_item_precau_p280',
            'custitem_srp_hbno_item_precau_p321',
            'custitem_srp_hbno_item_precau_p330',
            'custitem_srp_hbno_item_precau_p331',
            'custitem_srp_hbno_item_precau_p233',
            'custitem_srp_hbno_item_precau_p235',
            'custitem_srp_hbno_item_precau_p240',
            'custitem_srp_hbno_item_precau_p241',
            'custitem_srp_hbno_item_precau_p242',
            'custitem_srp_hbno_item_precau_p243',
            'custitem_srp_hbno_item_precau_p260',
            'custitem_srp_hbno_item_precau_p281',
            'custitem_srp_hbno_item_precau_p301',
            'custitem_srp_hbno_item_precau_p303',
            'custitem_srp_hbno_item_precau_p308',
            'custitem_srp_hbno_item_precau_p310',
            'custitem_srp_hbno_item_precau_p333',
            'custitem_srp_hbno_item_precau_p362',
            'custitem_srp_hbno_item_precau_p363',
            'custitem_srp_hbno_item_precau_p370',
            'custitem_srp_hbno_item_precau_p378',
            'custitem_srp_hbno_item_precau_p391',
            'custitem_srp_hbno_item_precau_p405',
            'custitem_srp_hbno_item_precau_p501'
        ];

        precautionFields.forEach((fieldId) => {
            const fieldValue = itemRecord.getValue({fieldId});
            if (fieldValue === true) {
                const field = itemRecord.getField({fieldId});
                if (field && field.label) {
                    statements += `${field.label}\n`;
                }
            }
        });

        return statements.trim();
    };

    // ================================
    // EXTERNAL API FUNCTIONS
    // ================================

    /**
     * Submits a job to the external label generation API
     * @param {Object} labelData - Label data object
     * @returns {string} Job ID from the API response
     */
    const submitLabelJob = (labelData) => {
        const headers = {
            'Content-Type': 'application/json',
            'Connection': 'keep-alive'
        };

        const response = http.post({
            url: 'http://98.81.113.107:5001/api/v1/jobs/',
            headers: headers,
            body: JSON.stringify([labelData])
        });

        log.debug('API Response', response);

        const result = JSON.parse(response.body);
        log.debug('Job Submission Result', result);

        return result.id;
    };

    /**
     * Waits for a job to complete by polling the API
     * @param {string} jobId - The job ID to monitor
     */
    const waitForJobCompletion = (jobId) => {
        let status = getJobStatus(jobId);
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loops

        log.debug('Initial Job Status', status);

// Waits for 1 second between each job status check
        while (status !== 'Completed' && attempts < maxAttempts) {
            status = getJobStatus(jobId);
            attempts++;
            log.debug('Job Status Check', `Attempt ${attempts}: ${status}`);

            // Wait for 1 second
            const start = Date.now();
            while (Date.now() - start < 1000) {
                // Busy-wait
            }
        }

        if (attempts >= maxAttempts) {
            throw new Error(`Job ${jobId} did not complete within maximum attempts`);
        }

        log.debug('Job Completed', `Job ${jobId} completed after ${attempts} attempts`);
    };

    /**
     * Gets the status of a job from the external API
     * @param {string} jobId - The job ID to check
     * @returns {string} Job status
     */
    const getJobStatus = (jobId) => {
        const response = http.get({
            url: `http://98.81.113.107:5001/api/v1/jobs/${jobId}`
        });

        const result = JSON.parse(response.body);
        return result.status;
    };

    /**
     * Retrieves a file from a completed job
     * @param {string} jobId - The job ID
     * @param {string} fileName - The name of the file to retrieve
     * @returns {string} Base64 encoded file content
     */
    const retrieveJobFile = (jobId, fileName) => {
        const response = http.get({
            url: `http://98.81.113.107:5001/api/v1/files/${jobId}/${fileName}/attachment`
        });

        return response.body;
    };

    // ================================
    // UTILITY FUNCTIONS
    // ================================

    /**
     * Saves a file to NetSuite file cabinet
     * @param {string} fileName - Name of the file
     * @param {string} fileContent - Base64 encoded file content
     * @returns {number} Internal ID of the saved file
     */
    const saveFileToNetSuite = (fileName, fileContent) => {
        const fileObj = file.create({
            name: fileName,
            fileType: file.Type.PDF,
            contents: fileContent,
            encoding: file.Encoding.BASE_64,
            folder: 811525 // File folder ID
        });

        return fileObj.save();
    };

    /**
     * Gets label mapping configuration for a specific label ID
     * @param {number} labelId - The label ID to get mapping for
     * @returns {Object} Label mapping object
     */
    const getLabelMapping = (labelId) => {
        const mapping = {};

        log.debug('Getting Label Mapping', `Label ID: ${labelId}`);

        const searchObj = search.create({
            type: 'customrecord_srp_hbno_label_mapping_rec',
            filters: [
                ['custrecord_srp_hbno_label_map_label', 'anyof', labelId]
            ],
            columns: [
                search.createColumn({name: 'name'}),
                search.createColumn({name: 'custrecord_srp_hbno_label_map_internalid'})
            ]
        });

        searchObj.run().each((result) => {
            const key = result.getValue({name: 'name'});
            const internalId = result.getValue('custrecord_srp_hbno_label_map_internalid');
            mapping[key] = internalId;
            return true;
        });

        return mapping;
    };

    /**
     * Gets the name of a printer by ID
     * @param {number} printerId - The printer ID
     * @returns {string} Printer name
     */
    const getPrinterName = (printerId) => {
        return getRecordNameById('customrecord_srp_hbno_printers_rec', printerId);
    };

    /**
     * Gets the name of a label template by ID
     * @param {number} labelId - The label ID
     * @returns {string} Label name
     */
    const getLabelName = (labelId) => {
        return getRecordNameById('customrecord_srp_hbno_labels_rec', labelId);
    };

    /**
     * Gets the name field value for a record by type and ID
     * @param {string} recordType - The record type
     * @param {number} recordId - The record ID
     * @returns {string} Name field value
     */
    const getRecordNameById = (recordType, recordId) => {
        const fieldLookup = search.lookupFields({
            type: recordType,
            id: recordId,
            columns: ['name']
        });

        return fieldLookup['name'] || '';
    };

    /**
     * Creates a data record for storing job information
     * @param {string} jobId - The job ID
     * @param {number} labelId - The label ID
     * @param {number} printerId - The printer ID
     * @param {string} response - The API response
     * @returns {number} Internal ID of the created record
     */
    const createDataRecord = (jobId, labelId, printerId, response) => {
        const rec = record.create({
            type: 'customrecord_srp_label_integrat_data_rec'
        });

        rec.setValue({fieldId: 'custrecord_srp_label_resp_data_job_id', value: jobId});
        rec.setValue({fieldId: 'custrecord_srp_label_resp_data_label_id', value: labelId});
        rec.setValue({fieldId: 'custrecord_srp_label_resp_data_printer', value: printerId});
        rec.setValue({fieldId: 'custrecord_srp_label_resp_data_response', value: response});

        return rec.save();

    };

    // ================================
    // EXPORTS
    // ================================

    return {
        onRequest
    };
});

/*
 * CONFIGURATION REFERENCE:
 *
 * Item Receipt Template:
 * https://5221064-sb1.app.netsuite.com/app/common/custom/custrecordentry.nl?rectype=4761&id=3
 *
 * Custom Fields Reference:
 * - Fire Class: custitem_srp_fireclass
 * - Flash Point: custitem_srp_fp
 * - Signal Word: custitem_hbno_signal_word
 * - CAS: custitem14
 * - EC: custitem59
 * - UN Number: custitem_srp_unnumber
 *
 * Work Order Fields:
 * - Top Number: custbody360
 * - String Below Number: custbody361
 * - Lot: custbody28
 */