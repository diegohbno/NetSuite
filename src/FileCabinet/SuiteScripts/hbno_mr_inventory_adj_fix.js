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

            const searchResults = search.load({id: 'customsearch_shipment_notes_no_inv_adj'});
            log.debug('Número de searchResults', searchResults);

            const resultCount = searchResults.runPaged().count;

            log.debug('Número de resultados', resultCount);
            return search.load({id: 'customsearch_shipment_notes_no_inv_adj'});
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
            log.debug('reduce', 'Start reduce function');
            const resultObj = JSON.parse(context.values[0]);
            log.debug('resultObj', resultObj)
            const salesOrderId = resultObj.values["GROUP(internalid.CUSTBODY_SRP_CREATEDFROMSAMPLE_SO)"].value;

            log.debug('Reducing Receipt ID', salesOrderId);


            // Search for all 3PL Shipment Notes created from this sales order with empty linked inventory adjustment
            const shipmentNoteSearch = search.create({
                type: 'customsale_srp_f3plo',
                filters: [
                    ['custbody_srp_createdfromsample_so', 'anyof', salesOrderId],
                    "AND",
                    ["custbody_srp_linked_inventory_adj", "anyof", "@NONE@"],
                    "AND",
                    ["cogs", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    'AND',
                    ['mainline', 'is', 'F']
                ],
                columns: ['internalid']
            });

            let shipmentNoteIds = [];
            shipmentNoteSearch.run().each(result => {
                shipmentNoteIds.push(result.getValue({name: 'internalid'}));
                return true;
            });
            shipmentNoteIds = [...new Set(shipmentNoteIds)];

            log.debug('Shipment Notes with empty linked inventory adjustment', shipmentNoteIds);

            // Aggregate quantities by bin number and serial/lot number from inventory detail lines of all shipment notes
            // Structure: { [binNumber]: { [serialLot]: { qty: totalQty, location: locationId, itemId: itemId } } }
            const binSerialLotQtyMap = {};
            shipmentNoteIds.forEach(shipmentNoteId => {
                log.debug('Processing shipmentNoteId', shipmentNoteId);
                try {
                    const shipmentRec = record.load({
                        type: 'customsale_srp_f3plo',
                        id: shipmentNoteId,
                        isDynamic: false
                    });

                    const itemLineCount = shipmentRec.getLineCount({sublistId: 'item'});
                    log.debug('itemLineCount', itemLineCount);
                    for (let i = 0; i < itemLineCount; i++) {
                        // Get itemId from the line
                        const itemId = shipmentRec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        // Try to get inventory detail subrecord
                        let inventoryDetail;
                        try {
                            inventoryDetail = shipmentRec.getSublistSubrecord({
                                sublistId: 'item',
                                fieldId: 'inventorydetail',
                                line: i
                            });
                            log.debug('inventoryDetail loaded', {shipmentNoteId, line: i});
                        } catch (e) {
                            log.debug('No inventory detail subrecord for line', `ShipmentNoteId: ${shipmentNoteId}, Line: ${i}`);
                            continue;
                        }
                        const invAssignCount = inventoryDetail.getLineCount({sublistId: 'inventoryassignment'});
                        log.debug('invAssignCount', invAssignCount);
                        for (let j = 0; j < invAssignCount; j++) {
                            const binNumber = inventoryDetail.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'binnumber',
                                line: j
                            });
                            const qty = inventoryDetail.getSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'quantity',
                                line: j
                            });
                            const serialLot = inventoryDetail.getSublistText({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                line: j
                            });
                            // Get the location from the bin record
                            let location = null;
                            try {
                                const binFields = search.lookupFields({
                                    type: 'bin',
                                    id: binNumber,
                                    columns: ['location']
                                });
                                location = binFields.location && binFields.location[0] && binFields.location[0].value
                                    ? binFields.location[0].value
                                    : null;
                                log.debug('Bin location lookup', {binNumber, location});
                            } catch (e) {
                                log.error('Error looking up bin location', `Bin: ${binNumber}, Error: ${e.message}`);
                            }
                            if (!binSerialLotQtyMap[binNumber]) {
                                binSerialLotQtyMap[binNumber] = {};
                            }
                            if (!binSerialLotQtyMap[binNumber][serialLot]) {
                                binSerialLotQtyMap[binNumber][serialLot] = {qty: 0, location: location, itemId: itemId};
                            }
                            binSerialLotQtyMap[binNumber][serialLot].qty += qty;
                            // Always update location and itemId in case it changes (should be the same for the same bin/serialLot)
                            binSerialLotQtyMap[binNumber][serialLot].location = location;
                            binSerialLotQtyMap[binNumber][serialLot].itemId = itemId;
                        }
                    }
                } catch (e) {
                    log.error('Error loading or processing shipment note', `ID: ${shipmentNoteId}, Error: ${e.message}`);
                }
            });

            log.debug('Aggregated quantity by bin number and serial/lot (with location)', binSerialLotQtyMap);

            const itemsQtyObj = {};

            // Collect all unique soId (serialLot) values for a single search per reduce
            const allSerialLots = [];
            Object.entries(binSerialLotQtyMap).forEach(([binId, soMap]) => {
                Object.keys(soMap).forEach(soId => {
                    if (!allSerialLots.includes(soId)) {
                        allSerialLots.push(soId);
                    }
                });
            });
            log.debug('All unique serialLots for assemblyitem search', allSerialLots);

            // Run a single search for all serialLots (soId) at once
            if (allSerialLots.length > 0) {
                let filters = [
                    ["type", "anyof", "Assembly"],
                    "AND",
                    ["inventorynumberbinonhand.quantityonhand", "notequalto", "0"],
                    "AND",
                    ["formulanumeric: case when {inventorynumberbinonhand.binnumber} = {binonhand.binnumber} then '1' else '0' end", "equalto", "1"],
                    "AND",
                    ["formulanumeric: case when {inventorynumberbinonhand.inventorynumber} = {inventorynumber.inventorynumber} then 1 else 0 end", "equalto", "1"],
                    "AND",
                    ["formulanumeric: case when {inventorynumberbinonhand.location} = {binonhand.location} then '1' else '0' end", "equalto", "1"],
                    "AND",
                    ["formulanumeric: case when {inventorynumberbinonhand.location} = {inventorynumber.location} then 1 else 0 end ", "equalto", "1"]
                ];
                // Add the serialLot filter as a disjunction (OR) if more than one, otherwise as a single filter
                if (allSerialLots.length === 1) {
                    filters.push("AND", ["inventorynumber.inventorynumber", "is", allSerialLots[0]]);
                } else if (allSerialLots.length > 1) {
                    filters.push("AND");
                    let orFilters = [];
                    allSerialLots.forEach((serialLot, idx) => {
                        orFilters.push(["inventorynumber.inventorynumber", "is", serialLot]);
                        if (idx < allSerialLots.length - 1) {
                            orFilters.push("OR");
                        }
                    });
                    filters = filters.concat(orFilters);
                }

                var assemblyitemSearchObj = search.create({
                    type: "assemblyitem",
                    filters: filters,
                    columns: [
                        search.createColumn({
                            name: "itemid",
                            summary: "GROUP",
                            label: "Name"
                        }),
                        search.createColumn({
                            name: "inventorynumber",
                            join: "inventoryNumberBinOnHand",
                            summary: "GROUP",
                            label: "Inventory Number"
                        }),
                        search.createColumn({
                            name: "binnumber",
                            join: "inventoryNumberBinOnHand",
                            summary: "GROUP",
                            label: "Bin Number"
                        }),
                        search.createColumn({
                            name: "quantityonhand",
                            join: "inventoryNumberBinOnHand",
                            summary: "GROUP",
                            label: "On Hand"
                        }),
                        search.createColumn({
                            name: "quantityavailable",
                            join: "inventoryNumberBinOnHand",
                            summary: "GROUP",
                            label: "Available"
                        }),
                        search.createColumn({
                            name: "quantityonhand",
                            join: "binOnHand",
                            summary: "MAX",
                            label: "On Hand"
                        }),
                        search.createColumn({
                            name: "internalid",
                            summary: "GROUP",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "location",
                            join: "inventoryNumberBinOnHand",
                            summary: "GROUP",
                            label: "Location"
                        })
                    ]
                });
                assemblyitemSearchObj.run().each(function (result) {
                    // Save in itemsQtyObj: {binNumber: [{inventoryNumber, onHand, location, itemId}]}
                    const foundBinNumber = result.getValue({
                        name: "binnumber",
                        join: "inventoryNumberBinOnHand",
                        summary: "GROUP"
                    });
                    const foundInventoryNumber = result.getValue({
                        name: "inventorynumber",
                        join: "inventoryNumberBinOnHand",
                        summary: "GROUP"
                    });
                    const foundQtyOnHand = result.getValue({
                        name: "quantityonhand",
                        join: "inventoryNumberBinOnHand",
                        summary: "GROUP"
                    });
                    const foundLocation = result.getValue({
                        name: "location",
                        join: "inventoryNumberBinOnHand",
                        summary: "GROUP"
                    });
                    const foundItemId = result.getValue({name: "internalid", summary: "GROUP"});
                    if (!itemsQtyObj[foundBinNumber]) {
                        itemsQtyObj[foundBinNumber] = [];
                    }
                    itemsQtyObj[foundBinNumber].push({
                        inventoryNumber: foundInventoryNumber,
                        onHand: foundQtyOnHand,
                        location: foundLocation,
                        itemId: foundItemId
                    });
                    log.debug('itemsQtyObj updated', {
                        bin: foundBinNumber,
                        inventoryNumber: foundInventoryNumber,
                        onHand: foundQtyOnHand,
                        location: foundLocation,
                        itemId: foundItemId
                    });
                    return true;
                });
            }

            log.debug('itemsQtyObj final', itemsQtyObj);


            // --- CREATE INVENTORY ADJUSTMENT ---
            // Example subsidiary ID for 3PL (replace with your actual subsidiary internal ID)
            const SUBSIDIARY_3PL_ID = 4; // <-- Update this value as needed

            try {
                log.debug('Creating Inventory Adjustment - START', {
                    subsidiary: SUBSIDIARY_3PL_ID,
                    itemsQtyObj: JSON.stringify(itemsQtyObj),
                    binSerialLotQtyMap: JSON.stringify(binSerialLotQtyMap)
                });

                // Agrupa itemsQtyObj por itemId y suma qty
                const itemIdQtyMap = {};
                Object.entries(itemsQtyObj).forEach(([binNumber, itemArr]) => {
                    itemArr.forEach(itemObj => {
                        const itemId = itemObj.itemId;
                        const qty = Number(itemObj.onHand);
                        const inventoryNumber = itemObj.inventoryNumber;
                        const location = itemObj.location;
                        if (!itemIdQtyMap[itemId]) {
                            itemIdQtyMap[itemId] = [];
                        }
                        itemIdQtyMap[itemId].push({
                            binNumber,
                            qty,
                            inventoryNumber,
                            location
                        });
                    });
                });

                // Suma total qty por itemId
                const itemIdTotalQty = {};
                Object.entries(itemIdQtyMap).forEach(([itemId, arr]) => {
                    itemIdTotalQty[itemId] = arr.reduce((sum, obj) => sum + Number(obj.qty), 0);
                });

                // Crea Inventory Adjustment
                const invAdjRec = record.create({
                    type: record.Type.INVENTORY_ADJUSTMENT,
                    isDynamic: true
                });


                invAdjRec.setValue({fieldId: 'subsidiary', value: SUBSIDIARY_3PL_ID});
                invAdjRec.setValue({fieldId: 'memo', value: 'created from ' + salesOrderId});
                invAdjRec.setValue({fieldId: 'account', value: 575});

                // Lineas negativas agrupadas por itemId
                Object.entries(itemIdQtyMap).forEach(([itemId, arr]) => {
                    log.debug('Processing negative adjustment line', {itemId, arr});
                    // Usa cada objeto de arr para crear una línea negativa con su qty
                    arr.forEach(obj => {
                        const {binNumber, qty, inventoryNumber, location} = obj;
                        log.debug('itemId', itemId);
                        log.debug('location', location);
                        log.debug('qty', qty);

                        invAdjRec.selectNewLine({sublistId: 'inventory'});
                        invAdjRec.setCurrentSublistValue({sublistId: 'inventory', fieldId: 'item', value: itemId});
                        if (location) {
                            invAdjRec.setCurrentSublistValue({
                                sublistId: 'inventory',
                                fieldId: 'location',
                                value: location
                            });
                        }
                        invAdjRec.setCurrentSublistValue({
                            sublistId: 'inventory',
                            fieldId: 'adjustqtyby',
                            value: -Math.abs(qty)
                        });

                        // Inventory detail negativo
                        const inventoryDetail = invAdjRec.getCurrentSublistSubrecord({
                            sublistId: 'inventory',
                            fieldId: 'inventorydetail'
                        });
                        inventoryDetail.selectNewLine({sublistId: 'inventoryassignment'});

                        // Buscar el internalid del serial/lot number (inventorynumber) por texto
                        let inventoryNumberId = null;
                        if (inventoryNumber) {
                            try {
                                const invNumSearch = search.create({
                                    type: 'inventorynumber',
                                    filters: [
                                        ['inventorynumber', 'is', inventoryNumber],
                                        'AND',
                                        ['item', 'anyof', itemId]
                                    ],
                                    columns: ['internalid']
                                });
                                const invNumResult = invNumSearch.run().getRange({start: 0, end: 1});
                                if (invNumResult && invNumResult.length > 0) {
                                    inventoryNumberId = invNumResult[0].getValue({name: 'internalid'});
                                    log.debug('Found inventorynumber id', {inventoryNumber, inventoryNumberId});
                                } else {
                                    log.debug('No inventorynumber id found for', {inventoryNumber, itemId});
                                }
                            } catch (e) {
                                log.error('Error searching inventorynumber id', e);
                            }
                        }
                        log.debug('inventoryNumberId', inventoryNumberId);
                        if (inventoryNumberId) {
                            inventoryDetail.setCurrentSublistValue({
                                sublistId: 'inventoryassignment',
                                fieldId: 'issueinventorynumber',
                                value: inventoryNumberId
                            });
                        }
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'binnumber',
                            value: Number(binNumber)
                        });
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: -Math.abs(qty)
                        });

                        inventoryDetail.commitLine({sublistId: 'inventoryassignment'});
                        invAdjRec.commitLine({sublistId: 'inventory'});

                        log.debug('Added negative inventory adjustment line', {
                            itemId,
                            binNumber,
                            inventoryNumber,
                            inventoryNumberId,
                            negativeQty: -Math.abs(qty),
                            location
                        });
                    });
                });

                // Lineas positivas: por cada linea de binSerialLotQtyMap
                Object.entries(binSerialLotQtyMap).forEach(([binNumber, serialLotMap]) => {
                    Object.entries(serialLotMap).forEach(([serialLot, obj]) => {
                        log.debug('Processing positive adjustment line', {binNumber, serialLot, obj});
                        let itemId = obj.itemId || null;
                        let location = obj.location;
                        let qty = Math.abs(Number(obj.qty));
                        if (!itemId) {
                            log.debug('No itemId found for positive line', {binNumber, serialLot});
                            return;
                        }
                        invAdjRec.selectNewLine({sublistId: 'inventory'});
                        invAdjRec.setCurrentSublistValue({sublistId: 'inventory', fieldId: 'item', value: itemId});
                        if (location) {
                            invAdjRec.setCurrentSublistValue({
                                sublistId: 'inventory',
                                fieldId: 'location',
                                value: location
                            });
                        }
                        invAdjRec.setCurrentSublistValue({
                            sublistId: 'inventory',
                            fieldId: 'adjustqtyby',
                            value: qty
                        });

                        // Inventory detail positivo
                        const inventoryDetail = invAdjRec.getCurrentSublistSubrecord({
                            sublistId: 'inventory',
                            fieldId: 'inventorydetail'
                        });
                        inventoryDetail.selectNewLine({sublistId: 'inventoryassignment'});

                        // Set receiptinventorynumber directly from serialLot (assumed to be the internalid or text)
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            value: serialLot
                        });

                        log.debug('inventoryDetail setCurrentSublistValue for receiptinventorynumber', serialLot);
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'binnumber',
                            value: Number(binNumber)
                        });
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: qty
                        });

                        inventoryDetail.commitLine({sublistId: 'inventoryassignment'});
                        invAdjRec.commitLine({sublistId: 'inventory'});

                        log.debug('Added positive inventory adjustment line', {
                            itemId,
                            binNumber,
                            inventoryNumber: serialLot,
                            positiveQty: qty,
                            location
                        });
                    });
                });

                log.debug('Creating Inventory Adjustment - END, about to save', {});
                const invAdjId = invAdjRec.save({enableSourcing: true, ignoreMandatoryFields: false});
                log.audit('Inventory Adjustment created', `ID: ${invAdjId}`);

                // Update the original sales order with the inventory adjustment ID
                try {
                    if (salesOrderId && invAdjId) {
                        log.debug('Updating sales order', { salesOrderId, invAdjId });
                        record.submitFields({
                            type: 'salesorder',
                            id: salesOrderId,
                            values: {
                                custbody_fix_inventory_adjustment: invAdjId
                            }
                        });
                        log.audit('Sales order updated with inventory adjustment', { salesOrderId, invAdjId });
                    }
                } catch (e) {
                    log.error('Error updating sales order with inventory adjustment', e);
                }

                // Load and save all related customsale_srp_f3plo records from shipmentNoteIds
                try {
                    log.debug('Loading and saving customsale_srp_f3plo records', shipmentNoteIds);
                    shipmentNoteIds.forEach(id => {
                        try {
                            const f3ploRec = record.load({
                                type: 'customsale_srp_f3plo',
                                id: id,
                                isDynamic: false
                            });
                            f3ploRec.save();
                            log.debug('Saved customsale_srp_f3plo', id);
                        } catch (e) {
                            log.error('Error loading/saving customsale_srp_f3plo', { id, error: e });
                        }
                    });
                } catch (e) {
                    log.error('Error in batch load/save of customsale_srp_f3plo', e);
                }

            } catch (e) {
                log.error('Error creating Inventory Adjustment', e);
            }

        } catch (e) {
            log.error('Error in reduce', e);
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
        log.debug('sublistId', sublistId)

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
