/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Diego
 * @description
 *   This script validates that the quantity on each Sales Order (SO) line equals:
 *     - the quantity shipped (from Shipment Notes) +
 *     - the quantity available in inventory (by serial number).
 *   If there's a discrepancy, it flags the shipment lines using a custom checkbox field.
 */

define(['N/search', 'N/record', 'N/log'],
    (search, record, log) => {

        // Saved search internal IDs (replace with your actual IDs)
        const SEARCH_IDS = {
            SO_QUANTITY: 'customsearch_so_quantity',
            SHIPMENT_NOTE: 'customsearch_shipment_note_bins',
            INVENTORY_DETAIL: 'customsearch_inventory_detail'
        };

        // Custom checkbox field to flag discrepancies
        const DISCREPANCY_FIELD = 'custcol_hbno_discrepancy';

        /**
         * Entry point: loads the main Sales Order Quantity search.
         * Each result is an SO line with an item and quantity.
         * @returns {Search} - The loaded saved search
         */
        const getInputData = () => {
            try {
                return search.load({id: SEARCH_IDS.SO_QUANTITY});
            } catch (e) {
                log.error('Failed to load input search', e);
            }
        };

        /**
         * Maps each SO-item pair to a composite key.
         * @param {MapContext} context - Map stage context
         */
        const map = (context) => {
            try {
                const result = JSON.parse(context.value);
                log.debug('result', result)
                log.debug('result', typeof result)

                const soId = result.id;
                log.debug('soId', soId)

                const itemId = result.values.item.value;
                log.debug('itemId', itemId)

                const soTotal = parseFloat(result.values["quantity"]);

                const key = `${soId}_${itemId}`;

                log.debug('Map stage', {soId, itemId, soTotal});

                context.write({
                    key,
                    value: {soId, itemId, soTotal}
                });

            } catch (e) {
                log.error('Map error', e);
            }
        };

        /**
         * Processes each unique SO-item pair to:
         *  - calculate shipped quantity
         *  - calculate available inventory
         *  - calculate discrepancy
         *  - flag shipment line if discrepancy ≠ 0
         * @param {ReduceContext} context
         */
        const reduce = (context) => {
            try {
                const {soId, itemId, soTotal} = JSON.parse(context.values[0]);

                log.debug('Reduce stage - start', {soId, itemId, soTotal});


                var workorderSearchObj = search.create({
                    type: "workorder",
                    filters:
                        [
                            ["createdfrom", "anyof", soId],
                            "AND",
                            ["type", "anyof", "WorkOrd"]
                        ]
                });
                var searchResultCount = workorderSearchObj.runPaged().count;
                log.debug("workorderSearchObj result count", searchResultCount);
                let woIds = [];
                workorderSearchObj.run().each(function (result) {
                    woIds.push(result.id);
                    return true;
                });
                log.debug('woIds', woIds)

                var assemblybuildSearchObj = search.create({
                    type: "assemblybuild",
                    settings: [{"name": "consolidationtype", "value": "ACCTTYPE"}],
                    filters:
                        [
                            ["type", "anyof", "Build"],
                            "AND",
                            ["createdfrom", "anyof", woIds],
                            "AND",
                            ["mainline", "is", "T"]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "inventorynumber",
                                join: "inventoryDetail",
                                label: " Number"
                            })
                        ]
                });
                var searchResultCount = assemblybuildSearchObj.runPaged().count;
                log.debug("assemblybuildSearchObj result count", searchResultCount);
                let assamblyBuildIds = [];
                assemblybuildSearchObj.run().each(function (result) {
                    log.debug('result', result)
                    assamblyBuildIds.push(result.getText({
                        name: "inventorynumber",
                        join: "inventoryDetail"
                    }));
                    return true;
                });
                log.audit('assemblybuildSearchObj result count', assamblyBuildIds);
                //for (let i = 0; i < assamblyBuildIds.length; i++) {
                log.debug('soId', soId);


                let tranid = search.lookupFields({
                    type: record.Type.SALES_ORDER,
                    id: soId,
                    columns: ['tranid']
                }).tranid;
                log.debug('tranid', tranid)

                const shipmentTotal = getShipmentNoteTotal(soId, itemId);
                log.debug('Shipment Total', shipmentTotal);
                const inventoryTotal = getInventoryDetailTotal(assamblyBuildIds, itemId);
                log.debug('inventoryTotal', inventoryTotal);

                const discrepancy = parseFloat((soTotal - shipmentTotal - inventoryTotal).toFixed(2));

                log.audit('Discrepancy Calculation', {
                    soId,
                    itemId,
                    soTotal,
                    shipmentTotal,
                    inventoryTotal,
                    discrepancy
                });
                if (discrepancy !== 0) {
                    flagShipmentLines(tranid, itemId, soId);
                }
                //     }


            } catch (e) {
                log.error('Reduce error', e);
            }
        };

        /**
         * Gets the total quantity shipped for a given SO and item
         * by filtering the Shipment Note saved search.
         * @param {string} soId
         * @param {string} itemId
         * @returns {number} total shipped quantity
         */
        const getShipmentNoteTotal = (soId, itemId) => {
            const searchObj = search.load({id: SEARCH_IDS.SHIPMENT_NOTE});
            log.debug('soId', soId)
            searchObj.filters.push(
                search.createFilter({
                    name: 'custbody_srp_createdfromsample_so',
                    operator: search.Operator.ANYOF,
                    values: soId
                }),
                search.createFilter({
                    name: 'item',
                    operator: search.Operator.IS,
                    values: itemId
                })
            );
            log.debug('itemId', itemId)
            log.debug('test', '111')
            log.debug('searchObj', searchObj)

            let total = 0;
            searchObj.run().each(result => {
                log.debug('result', result)
                const qty = result.getValue({
                    name: 'quantity',
                    join: 'inventoryDetail',// Internal ID of the grouped field
                    summary: search.Summary.GROUP
                }) || 0;
               log.audit('qty', qty)

                total = Number(total) + Number(qty);
                return true;
            });
            log.debug('total', total)
            return total;


        };

        /**
         * Gets the available inventory quantity for a given SO and item
         * by filtering the Inventory Detail saved search.
         * @param {string} soId
         * @param {string} itemId
         * @returns {number} total available inventory
         */
        const getInventoryDetailTotal = (assamblyBuildIds, itemId) => {
            let total = 0;
            for (let i = 0; i < assamblyBuildIds.length; i++) {
                const searchObj = search.load({id: SEARCH_IDS.INVENTORY_DETAIL});
                searchObj.filters.push(
                    search.createFilter({
                        name: 'internalid',
                        operator: search.Operator.ANYOF,
                        values: itemId
                    }),
                    search.createFilter({
                        name: 'serialnumber',
                        operator: search.Operator.IS,
                        values: assamblyBuildIds[i]
                    })
                );


                searchObj.run().each(result => {
                    const qty = parseFloat(result.getValue({
                        name: 'quantityavailable',
                        join: "inventoryNumberBinOnHand",
                        summary: "GROUP"
                    })) || 0;
                    log.debug('qty', qty)
                    total += qty;
                    return true;
                });
                log.debug('total2', total)
            }


            return total;


        };

        /**
         * Flags the shipment lines for the given SO and item
         * by setting a custom checkbox on each matching line.
         * @param {string} soId
         * @param {string} itemId
         */
        const flagShipmentLines = (soId, itemId, tranId) => {
            const searchObj = search.load({id: SEARCH_IDS.SHIPMENT_NOTE});
            log.debug('soId', soId)
            log.debug('itemId', itemId)

            searchObj.filters.push(
                /* search.createFilter({
                     name: 'inventorynumber',
                     join: 'inventorydetail',
                     operator: search.Operator.ANYOF,
                     values: soId
                 }),*/
                search.createFilter({
                    name: 'internalidnumber',
                    join: 'custbody_srp_createdfromsample_so',
                    operator: search.Operator.EQUALTO,
                    values: tranId
                }),
                search.createFilter({
                    name: 'item',
                    operator: search.Operator.IS,
                    values: itemId
                })
            );
            log.debug('searchObjFFF', searchObj)
            var searchResultCount = searchObj.runPaged().count;

            log.debug("discrepancy result count", searchResultCount);
            searchObj.run().each(result => {
                log.audit('result DDDD',result)
                // Get the value of CuTrSale
                var recordType = 'customsale_srp_f3plo'


                log.audit('recordType DDDD',recordType)

                const recordId = result.getValue({
                    name: 'internalid', // Internal ID of the grouped field
                    summary: search.Summary.GROUP
                });
                log.debug('recordType', recordType)
                log.debug('recordId', recordId)

                try {
                    const rec = record.load({type: recordType, id: recordId});
                    const lineCount = rec.getLineCount({sublistId: 'item'});
                    log.debug('lineCount', lineCount)

                    for (let i = 0; i < lineCount; i++) {
                        const currentItem = rec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                        log.debug('currentItem === itemId', currentItem === itemId)

                        if (currentItem === itemId) {
                            rec.setSublistValue({
                                sublistId: 'item',
                                fieldId: DISCREPANCY_FIELD,
                                line: i,
                                value: true
                            });
                            rec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol46',
                                line: i,
                                value: tranId
                            });

                            log.debug('Flagged line', {
                                recordType,
                                recordId,
                                itemId,
                                line: i
                            });
                        }
                    }

                    rec.save();
                    log.audit('Record saved after flagging', {recordType, recordId});

                } catch (innerErr) {
                    log.error('Error updating record', {
                        recordType,
                        recordId,
                        error: innerErr
                    });
                }

                return true;
            });


        };

        return {getInputData, map, reduce};
    });
