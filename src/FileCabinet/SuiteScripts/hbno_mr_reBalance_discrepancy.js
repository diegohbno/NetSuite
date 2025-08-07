/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    /**
     * Loads the saved search and returns only internal IDs of Consignment Receipts.
     * @returns {Array<string>} List of receipt IDs as keys.
     */
    const getInputData = () => {
        try {
            log.debug('getInputData', 'Loading receipt IDs from saved search');

            const searchResults = search.load({id: 'customsearch4795'});
            log.debug('Número de searchResults', searchResults);

            const resultCount = searchResults.runPaged().count;

            log.debug('Número de resultados', resultCount);
            return search.load({id: 'customsearch4795'});
        } catch (e) {
            log.error('Error', e);
        }
    };

    /**
     * Processes each Consignment Receipt:
     * 1. Updates its inventory detail bin assignments.
     * 2. Updates the linked Inventory Adjustment.
     * 3. Saves all related Shipment Notes without Linked Inventory Adjustment.
     *
     * @param {ReduceContext} context - The reduce context.
     */
    const reduce = (context) => {
        try {

            const receiptId = context.key;
            log.debug('Reducing Receipt ID', receiptId);

            // Load Consignment Receipt
            const receipt = record.load({
                type: 'custompurchase_srp_r3plo',
                id: receiptId,
                isDynamic: false
            });

            log.debug('Receipt loaded', `ID: ${receiptId}`);

            // Update inventory details
            var a = updateInventoryDetails(receipt);
            log.debug('a0',a)

            log.audit('Receipt updated and saved', `ID: ${receiptId}`);

            // Linked Inventory Adjustment
            const adjId = receipt.getValue({fieldId: 'custbody_srp_linked_inventory_adj'});
            log.debug('adjId', adjId)
            if (adjId) {
                const adjustment = record.load({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    id: adjId,
                    isDynamic: false
                });

                log.debug('Inventory Adjustment loaded', `ID: ${adjId}`);
                var a  =updateInventoryDetails(adjustment);
 log.debug('a',a)

            }

            // Edit and save all 3PL Shipment Notes from custbody_srp_sn field
            let shipmentNoteIds = receipt.getValue({fieldId: 'custbody_srp_sn'});
            log.debug('shipmentNoteIds', shipmentNoteIds);

            if (shipmentNoteIds) {
                // If it's a string, split by comma; if array, use directly
                if (typeof shipmentNoteIds === 'string') {
                    shipmentNoteIds = shipmentNoteIds.split(',').map(id => id.trim()).filter(Boolean);
                }
                if (!Array.isArray(shipmentNoteIds)) shipmentNoteIds = [shipmentNoteIds];
                log.debug('Processed Shipment Note IDs', shipmentNoteIds);
                shipmentNoteIds.forEach(shipmentId => {
                    try {
                        log.debug('shipmentId', shipmentId)
                        const shipmentNote = record.load({
                            type: 'customsale_srp_f3plo',
                            id: shipmentId,
                            isDynamic: false
                        });
                        log.audit('Shipment Note saved', `ID: ${shipmentId}`);
                    } catch (e) {
                        log.error('Error saving Shipment Note', `ID: ${shipmentId}, Error: ${e.message}`);
                    }
                });
            }
        } catch (e) {
            log.error(`Error processing receipt ID ${receiptId}`, e);
        }
    };

    /**
     * Moves all inventory assignments to the bin of the first line.
     *
     * @param {Record} rec - The record (Consignment Receipt or Inventory Adjustment).
     */
    function updateInventoryDetails(rec) {
        log.debug('updateInventoryDetails', `Processing record ID: ${rec.id}, Type: ${rec.type}`);
        var sublistId = rec.type === 'inventoryadjustment' ? 'inventory' : 'item';
        const lineCount = rec.getLineCount({sublistId: sublistId});
        log.debug('sublistId',sublistId)

        log.debug('Line count', lineCount);
        if (lineCount === 0) {
            log.warning('No inventory lines found', `Record ID: ${rec.id}`);
            return;
        }

        const bin = getFirstBin(rec, 0, sublistId);
        log.debug('bin', bin);

        if (!bin) {
            log.warning('Could not determine bin from first inventory line', `Record ID: ${rec.id}`);
            return;
        }

        log.debug('Reassigning bins', `Target bin: ${bin}, Total lines: ${lineCount}`);

        for (let i = 0; i < lineCount; i++) {

            const detailSubrecord = rec.getSublistSubrecord({
                sublistId: sublistId,
                fieldId: 'inventorydetail',
                line: i
            });

            const inventoryLineCount = detailSubrecord.getLineCount({sublistId: 'inventoryassignment'});
            log.debug('Inventory line count', inventoryLineCount);

            for (let j = 0; j < inventoryLineCount; j++) {
                detailSubrecord.setSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'binnumber',
                    line: j,
                    value: bin
                });
                log.debug('testttt')
            }

            log.debug('Bin reassigned for line', `Inventory line: ${i}`);

        }
        log.debug('Antes de save', `Record ID: ${rec.id}`);
        const savedId = rec.save();
        log.debug('Después de save', `Saved ID: ${savedId}`);
        return savedId;


    }

    /**
     * Gets the bin number from the first inventory assignment line.
     *
     * @param {Record} rec - The record from which to extract the bin number.
     * @param {number} lineIndex - The inventory line index to use (usually 0).
     * @returns {number|null} The internal ID of the bin, or null if not found.
     */
    function getFirstBin(rec, lineIndex, sublistId) {
        try {
            const detailSubrecord = rec.getSublistSubrecord({
                sublistId: sublistId,
                fieldId: 'inventorydetail',
                line: lineIndex
            });

            return detailSubrecord.getSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'binnumber',
                line: 0
            });
        } catch (e) {
            log.error('Failed to retrieve first bin', `Line: ${lineIndex}, Error: ${e.message}`);
            return null;
        }
    }

    return {
        getInputData,
        reduce
    };
});
