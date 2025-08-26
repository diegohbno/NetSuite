/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * @description
 * Map/Reduce script that updates the Fix Inventory Adjustment (custbody_fix_inventory_adjustment)
 * by adding a new line for each Sales Order with pending quantities.
 * It ensures pending Shipment Notes can be fulfilled by allocating the target Bin with the largest available quantity.
 */

define(['N/search', 'N/record', 'N/log'],
    (search, record, log) => {

        /**
         * getInputData
         * Load the saved search customsearch5104, which returns Sales Orders
         * with a Fix Inventory Adjustment but not fully shipped.
         */
        const getInputData = () => {
            log.debug('getInputData', 'Loading saved search customsearch5104');
            return search.load({id: 'customsearch5104'});
        };

        /**
         * map
         * For each Sales Order returned by the search:
         * - Get SO Quantity
         * - Get Shipment Notes Quantity
         * - Identify target Bin (bin with greatest qty)
         * - Calculate Pending Quantity
         * - Write result for reduce stage
         */
        const map = (context) => {
            try {
                const result = JSON.parse(context.value);
                log.debug('result', result);

                // Extract soId from result.values
                const soId = result.values["GROUP(internalid.CUSTBODY_SRP_CREATEDFROMSAMPLE_SO)"].value;
                log.debug('map', `Processing Sales Order: ${soId}`);

                // Load Sales Order
                const soRec = record.load({
                    type: 'salesorder',
                    id: soId
                });

                // Get total Sales Order quantity
                let soQuantity = 0;
                const lineCount = soRec.getLineCount({sublistId: 'item'});
                for (let i = 0; i < lineCount; i++) {
                    soQuantity += Number(soRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    })) || 0;
                }

                log.debug('map', `SO Total Quantity = ${soQuantity}`);

                // Search Shipment Notes linked to this SO
                const shipmentSearch = search.create({
                    type: 'customsale_srp_f3plo', // adjust record type if different
                    filters: [['custbody_srp_createdfromsample_so', 'anyof', soId]],
                    columns: [
                        search.createColumn({name: 'quantity'}),
                        search.createColumn({
                            name: "binnumber",
                            join: "inventoryDetail",
                        }),
                        search.createColumn({name: 'item'}),
                        search.createColumn({name: 'location'}),
                        search.createColumn({
                            name: 'inventorynumber',
                            join: 'inventoryDetail'
                        })
                    ]
                });

                let binMap = {};
                let binShipmentNoteIdMap = {};
                let binItemMap = {};
                let binLocationMap = {};
                let binSerialLotMap = {};
                let sumQty = 0;

                shipmentSearch.run().each(res => {
                    const qty = Number(res.getValue('quantity')) || 0;
                    log.audit('qty', qty)
                    sumQty += qty;
                    const bin = res.getValue({
                        name: 'binnumber',
                        join: 'inventoryDetail'
                    }) || 0;
                    const shipmentNoteId = res.id;
                    const item = res.getValue({name: 'item'}) || null;
                    const location = res.getValue({name: 'location'}) || null;
                    const serialLot = res.getText({
                        name: 'inventorynumber',
                        join: 'inventoryDetail'
                    }) || null;

                    if (bin) {
                        binMap[bin] = (binMap[bin] || 0) + qty;
                        // Always keep the shipmentNoteId with the highest qty for this bin
                        if (!binShipmentNoteIdMap[bin] || qty > binMap[bin]) {
                            binShipmentNoteIdMap[bin] = shipmentNoteId;
                            binItemMap[bin] = item;
                            binLocationMap[bin] = location;
                            binSerialLotMap[bin] = serialLot;
                        }
                    }
                    return true;
                });
                log.debug('sumQty', sumQty)

                log.debug('map', `binMap: ${JSON.stringify(binMap)}`);
                log.debug('map', `binShipmentNoteIdMap: ${JSON.stringify(binShipmentNoteIdMap)}`);
                log.debug('map', `binItemMap: ${JSON.stringify(binItemMap)}`);
                log.debug('map', `binLocationMap: ${JSON.stringify(binLocationMap)}`);
                log.debug('map', `binSerialLotMap: ${JSON.stringify(binSerialLotMap)}`);

                // Identify target bin = bin with greatest quantity
                let targetBin = null;
                let maxQty = 0;
                let targetShipmentNoteId = null;
                let targetItem = null;
                let targetLocation = null;
                let targetSerialLot = null;

                Object.keys(binMap).forEach(bin => {
                    if (binMap[bin] >= maxQty) {
                        targetBin = bin;
                        maxQty = binMap[bin];
                        targetShipmentNoteId = binShipmentNoteIdMap[bin];
                        targetItem = binItemMap[bin];
                        targetLocation = binLocationMap[bin];
                        targetSerialLot = binSerialLotMap[bin];
                    }
                });

                log.debug('map', `Target Bin = ${targetBin} (Qty = ${maxQty}), Shipment Note ID = ${targetShipmentNoteId}, Item = ${targetItem}, Location = ${targetLocation}, SerialLot = ${targetSerialLot}`);

                // Pending Quantity = SO Quantity - Shipment Notes Quantity
                const pendingQty = Number(soQuantity) - Number(sumQty);

                log.debug('map', `Pending Quantity = ${pendingQty}`);

                if (pendingQty > 0 && targetBin) {
                    // Lookup the customsale_srp_f3plo record using targetShipmentNoteId
                    let shipmentNoteLookup = null;
                    if (targetShipmentNoteId) {
                        shipmentNoteLookup = search.lookupFields({
                            type: 'customsale_srp_f3plo',
                            id: targetShipmentNoteId,
                            columns: ['internalid', 'tranid', 'quantity', 'binnumber']
                        });
                        log.debug('Shipment Note Lookup', shipmentNoteLookup);
                    }

                    context.write({
                        key: targetShipmentNoteId,
                        value: {
                            soId: soId,
                            pendingQty: pendingQty,
                            targetBin: targetBin,
                            targetShipmentNoteId: targetShipmentNoteId,
                            shipmentNoteLookup: shipmentNoteLookup,
                            item: targetItem,
                            location: targetLocation,
                            serialLot: targetSerialLot
                        }
                    });
                } else {
                    log.debug('map', `No pending qty for SO ${soId}, skipping`);
                }

            } catch (e) {
                log.error('map error', e);
            }
        };

        /**
         * reduce
         * For each Fix Inventory Adjustment, add a new line with:
         * - Qty = Pending Quantity
         * - Bin = Target Bin
         * - Location = 3PL HBNO
         */
        const reduce = (context) => {
            try {
                const fiaId = context.key;
                const values = context.values.map(v => JSON.parse(v));

                log.debug('reduce', `Updating Fix Inventory Adjustment ${fiaId}, values: ${JSON.stringify(values)}`);

                // Lookup customsale_srp_f3plo record using fiaId and get custbody_srp_linked_inventory_adj
                let linkedInventoryAdj = null;
                let soID;
                try {
                    let lookupResult = search.lookupFields({
                        type: 'customsale_srp_f3plo',
                        id: fiaId,
                        columns: ['custbody_srp_createdfromsample_so']
                    });
                    log.debug('lookupResult', lookupResult)
                    soID = lookupResult.custbody_srp_createdfromsample_so[0]?.value || null;
                    lookupResult = search.lookupFields({
                        type: record.Type.SALES_ORDER,
                        id: soID,
                        columns: ['custbody_fix_inventory_adjustment']
                    });
                    linkedInventoryAdj = lookupResult.custbody_fix_inventory_adjustment[0]?.value || null;
                    log.debug('reduce', `Lookup customsale_srp_f3plo for fiaId ${fiaId}: custbody_srp_linked_inventory_adj = ${JSON.stringify(linkedInventoryAdj)}`);
                } catch (e) {
                    log.error('reduce', `Error looking up customsale_srp_f3plo for fiaId ${fiaId}: ${e.message}`);
                }
                log.debug('linkedInventoryAdj', linkedInventoryAdj)

                const fiaRec = record.load({
                    type: 'inventoryadjustment',
                    id: linkedInventoryAdj,
                    isDynamic: true
                });
                log.debug('fiaRec', fiaRec)

                values.forEach(v => {
                    log.debug('reduce', `Processing value: ${JSON.stringify(v)}`);
                    fiaRec.selectNewLine({sublistId: 'inventory'});
                    log.debug('reduce', `Setting item: ${Math.abs(v.item)}`);
                    fiaRec.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'item',
                        value: Math.abs(v.item)
                    });
                    fiaRec.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'location',
                        value: 40
                    });
                    log.debug('reduce', `Setting adjustqtyby: ${Math.abs(v.pendingQty)}`);
                    fiaRec.setCurrentSublistValue({
                        sublistId: 'inventory',
                        fieldId: 'adjustqtyby',
                        value: Math.abs(v.pendingQty)
                    });

                    // Set inventory detail subrecord values for quantity, bin, and serial/lot number
                    const inventoryDetail = fiaRec.getCurrentSublistSubrecord({
                        sublistId: 'inventory',
                        fieldId: 'inventorydetail'
                    });
                    log.debug('reduce', `Setting inventoryassignment: bin=${v.targetBin}, qty=${Math.abs(v.pendingQty)}, serialLot=${v.serialLot}`);
                    inventoryDetail.selectNewLine({sublistId: 'inventoryassignment'});
                    if (v.serialLot) {
                        inventoryDetail.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'receiptinventorynumber',
                            value: v.serialLot
                        });
                    }
                    inventoryDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'binnumber',
                        value: v.targetBin
                    });
                    inventoryDetail.setCurrentSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'quantity',
                        value: Math.abs(v.pendingQty)
                    });

                    inventoryDetail.commitLine({sublistId: 'inventoryassignment'});
                    log.debug('reduce', 'Committed inventoryassignment line');

                    fiaRec.commitLine({sublistId: 'inventory'});
                    log.debug('reduce', 'Committed inventory line');
                });

                log.debug('reduce', 'Saving inventory adjustment record');
                const savedId = fiaRec.save();
                log.audit('reduce', `Updated Fix Inventory Adjustment ${savedId}`);

                record.submitFields({
                    type: record.Type.SALES_ORDER,
                    id: soID,
                    values: {
                        'custbody_hbno_so_rebalanced': true
                    }
                });
log.debug('soID',soID)

            } catch (e) {
                log.error('reduce error', e);
            }
        };

        const summarize = (summary) => {
            log.audit('summarize', 'Script completed');
            summary.mapSummary.errors.iterator().each((key, error) => {
                log.error('map error', `Key: ${key}, Error: ${error}`);
                return true;
            });
            summary.reduceSummary.errors.iterator().each((key, error) => {
                log.error('reduce error', `Key: ${key}, Error: ${error}`);
                return true;
            });
        };

        return {getInputData, map, reduce, summarize};
    });
