/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * @description
 * Validates Shipment Note inventory detail lines to ensure that the quantity per [Lot Number + Bin Number]
 * combination does not exceed the available quantity in the system. If it does, the script prevents save and
 * displays the available bins/quantities to the user.
 */
define(['N/search'], (search) => {

    /**
     * Runs before the record is saved.
     * @param {Object} context - Context object.
     * @param {Record} context.currentRecord - Current Shipment Note record.
     * @returns {boolean} True to continue save, false to prevent save.
     */
    const saveRecord = (context) => {
        try {
            const rec = context.currentRecord;
            const linkedIA = rec.getValue('custbody_srp_linked_inventory_adj');
            if (linkedIA) return true;

            // Map to sum quantities: key = `${lot}||${bin}`
            const shipmentQtyMap = {};

            const itemLineCount = rec.getLineCount({sublistId: 'item'});
            let itemID = null;
            console.log('itemLineCount:', itemLineCount);
            for (let i = 0; i < itemLineCount; i++) {
                rec.selectLine({sublistId: 'item', line: i});
                itemID = rec.getCurrentSublistValue({sublistId: 'item', fieldId: 'item'});
                const inventoryDetail = rec.getCurrentSublistSubrecord({
                    sublistId: 'item',
                    fieldId: 'inventorydetail'
                });
                if (!inventoryDetail) {
                    console.log('No inventoryDetail subrecord', {line: i});
                    continue;
                }

                const detailCount = inventoryDetail.getLineCount({sublistId: 'inventoryassignment'});

                for (let j = 0; j < detailCount; j++) {
                    const binId = inventoryDetail.getSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'binnumber',
                        line: j
                    });

                    let lotNumber = inventoryDetail.getSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'issueinventorynumber',
                        line: j
                    });
                    let lookUp = search.lookupFields({
                        type: 'inventorynumber',
                        id: lotNumber,
                        columns: ['inventorynumber']
                    });
                    lotNumber = lookUp?.inventorynumber || lotNumber || '';
                    const qty = parseFloat(inventoryDetail.getSublistValue({
                        sublistId: 'inventoryassignment',
                        fieldId: 'quantity',
                        line: j
                    })) || 0;


                    const key = `${lotNumber}||${binId}`;
                    shipmentQtyMap[key] = (shipmentQtyMap[key] || 0) + qty;
                }
            }

            console.log('itemID: ' + itemID);


            if (Object.keys(shipmentQtyMap).length === 0) {
                console.log('No bin/lot combinations to validate');
                return true;
            }

            const binIds = Array.from(
                new Set(
                    Object.keys(shipmentQtyMap)
                        .map(key => key.split('||')[1])
                        .filter(binId => !!binId)
                )
            );
            console.log('binIds for filter:', binIds);
            console.log('rec:', rec);

            const availableMap = {};
            const itemSearch = search.load({id: 'customsearch_inventory_detail_assemblies'});
            itemSearch.filters.push(
                search.createFilter({
                    name: 'internalidnumber',
                    operator: search.Operator.EQUALTO,
                    values: itemID
                })
            );

            if (binIds.length > 0) {
                itemSearch.filters.push(
                    search.createFilter({
                        name: 'binnumber',
                        join: 'inventorynumberbinonhand',
                        operator: search.Operator.ANYOF,
                        values: binIds
                    })
                );
            }

            itemSearch.run().each(result => {
                const lot = result.getValue({
                    name: 'inventorynumber',
                    join: 'inventoryNumberBinOnHand',
                    summary: 'GROUP'
                });
                const bin = result.getValue({name: 'binnumber', join: 'inventoryNumberBinOnHand', summary: 'GROUP'});
                const qtyAvail = parseFloat(result.getValue({
                    name: 'quantityavailable',
                    join: 'inventoryNumberBinOnHand',
                    summary: 'GROUP'
                })) || 0;


                const key = `${lot}||${bin}`;
                availableMap[key] = qtyAvail;
                return true;
            });

            let errorMsg = '';
            for (const key in shipmentQtyMap) {
                const [lot, bin] = key.split('||');
                const shipQty = shipmentQtyMap[key];
                const availQty = availableMap[key] || 0;

                console.log('Compare shipment vs available', {key, shipQty, availQty});

                if (shipQty > availQty) {
                    let lotName = '';
                    let binName = '';
                    try {
                        const lotLookup = search.lookupFields({
                            type: 'inventorynumber',
                            id: lot,
                            columns: ['externalid', 'inventorynumber']
                        });
                        lotName = lotLookup.inventorynumber || lot;
                        console.log('Lot lookup', lotLookup);
                    } catch (e) {
                        console.log('Lot lookup error', e);
                        lotName = lot;
                    }
                    try {
                        const binLookup = search.lookupFields({
                            type: 'bin',
                            id: bin,
                            columns: ['externalid', 'binnumber']
                        });
                        binName = binLookup.binnumber || bin;
                        console.log('Bin lookup', binLookup);
                    } catch (e) {
                        console.log('Bin lookup error', e);
                        binName = bin;
                    }

                    errorMsg += `Lot: ${lotName}, Bin: ${binName}, Available: ${availQty}, Requested: ${shipQty}\n`;
                }
            }

            if (errorMsg) {
                console.log('Validation failed', errorMsg);
                alert(
                    `Cannot save Shipment Note:\n` +
                    `The following bin/lot combinations have insufficient quantity:\n\n` +
                    errorMsg +
                    `\nPlease adjust your selections based on available stock.`
                );
                return false;
            }

            console.log('Validation passed, allowing save');
            return true;
        } catch (e) {
            console.log('Error validating Shipment Note bins/lots', e);
            alert('Unexpected error validating bin/lot quantities. Please contact the administrator.');
            return false;
        }
    };

    return {
        saveRecord
    };
});
