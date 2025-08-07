/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/runtime', 'N/record', 'N/file', 'N/log', 'N/render'],
    (runtime, record, file, log, render) => {

        /**
         * Renders the barcode label using a FreeMarker template and saves it as PDF.
         * @param {string} barcodeValue - The barcode value to encode.
         * @param {string} description - The product description.
         * @param {string} statusText - Additional text (e.g., "New").
         * @returns {number} File ID of the saved PDF.
         */
        function renderBarcodeLabelPDF(barcodeValue, description, statusText) {
            log.debug('Start renderBarcodeLabelPDF()', {barcodeValue, description, statusText});

            let templateFile;
            try {
                log.debug('Loading FTL template file...');
                templateFile = file.load({id: 888845}); // Update if needed
                log.debug('Template file loaded successfully.');
            } catch (e) {
                log.error('Error loading FTL template', e);
                throw e;
            }

            let renderer;
            try {
                renderer = render.create();
                log.debug('Renderer created.');
                renderer.templateContent = templateFile.getContents();
                log.debug('Template content set.');
                log.debug('barcodeValue', barcodeValue);
                log.debug('description', description);
                log.debug('statusText', statusText);

                renderer.addCustomDataSource({
                    format: render.DataSource.OBJECT,
                    alias: 'data',
                    data: {
                        barcodeValue: barcodeValue || 'TEST123',
                        description: description || 'Default description',
                        statusText: statusText || 'New'
                    }
                });
                log.debug('Data source added to renderer.');
            } catch (e) {
                log.error('Error setting up renderer', e);
                throw e;
            }

            let pdfFile;
            try {
                pdfFile = renderer.renderAsPdf();
                log.debug('PDF rendered.');
                pdfFile.name = `barcode_${Date.now()}.pdf`;
                pdfFile.name = `barcode_test.pdf`;
                pdfFile.folder = 540430; // Adjust folder ID
                pdfFile.description = description;
            } catch (e) {
                log.error('Error rendering PDF', e);
                throw e;
            }

            try {
                const fileId = pdfFile.save();
                log.debug('PDF saved in File Cabinet', {fileId});
                return fileId;
            } catch (e) {
                log.error('Error saving PDF file', e);
                throw e;
            }
        }

        /**
         * Updates the custom file field on the transaction.
         * @param {number} recId - Internal ID of the record.
         * @param {number} fileId - ID of the PDF file.
         */
        function setBarcodeField(recId, fileId) {
            log.debug('Updating record with barcode PDF', {recId, fileId});
            try {
                record.submitFields({
                    type: record.Type.WORK_ORDER, // Change to your record type
                    id: recId,
                    values: {
                        custbody_hbno_fnsku: fileId
                    }
                });
                log.debug('Field custbody293 updated.');
            } catch (e) {
                log.error('Error updating record with file ID', e);
                throw e;
            }
        }

        /**
         * User Event afterSubmit entry point
         */
        const afterSubmit = (context) => {
            try {
                const newRecord = context.newRecord;
                const recId = newRecord.id;
                const barcodeValue = newRecord.getValue({fieldId: 'custbody360'});
                const description = newRecord.getValue({fieldId: 'custbody361'});

                log.debug('afterSubmit triggered', {recId, barcodeValue, description});

                if (barcodeValue && description) {
                    const statusText = "NEW"; // Static for now, or dynamic if needed
                    const fileId = renderBarcodeLabelPDF(barcodeValue, description, statusText);
                    log.debug('fileId', fileId)
                    setBarcodeField(recId, fileId);
                } else {
                    log.debug('Skipping barcode generation - one or more required fields are empty');
                }

            } catch (e) {
                log.error('Unhandled error in afterSubmit', e);
            }
        };

        return {
            afterSubmit
        };
    });
