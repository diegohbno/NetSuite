/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/log'], function (record, search, log) {

    const MAX_RETRIES = 3; // Maximum retries per work order chain

    function afterSubmit(context) {
        try {
            log.debug('context.type', context.type + ' - UE context: ' + context.UserEventType.APPROVE);
            if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.APPROVE) return;

            var soRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: context.newRecord.id,
                isDynamic: true
            });

            var department = soRecord.getValue({ fieldId: 'department' });
            if (department != '4') return; // Only process for Private Label (department 4)

            var location = soRecord.getValue({ fieldId: 'location' });
            if (location != '1') return; // Only process for HBNO - Chico (location 1)

            var lineCount = soRecord.getLineCount({ sublistId: 'item' });
            for (var i = 0; i < lineCount; i++) {
                var workOrderId = soRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'woid',
                    line: i
                });
                log.debug('workOrderId', workOrderId);
                if (workOrderId) {
                    processWorkOrder(workOrderId, 0); // Start processing chain with retryCount=0
                }
            }
        } catch (e) {
            log.error("Error in afterSubmit", e.message);
        }
    }

    function getAvailableInventory(itemId) {
        var lots = [];

        var lotNumCol = search.createColumn({
            name: "formulanumeric",
            formula: "CASE WHEN {inventorynumber} LIKE 'Lot:%' THEN TO_NUMBER(REPLACE({inventorynumber}, 'Lot: ', '')) ELSE TO_NUMBER({inventorynumber}) END",
            sort: search.Sort.ASC
        })
        var itemSearch = search.create({
            type: "inventorynumber",
            filters: [
                ["item", "anyof", itemId],
                "AND",
                ["quantityavailable", "greaterthan", "0"]
            ],
            columns: [
                lotNumCol,
                search.createColumn({
                    name: "inventorynumber"
                }),
                search.createColumn({
                    name: "quantityavailable"
                })
            ]
        });

        var resultSet = itemSearch.run().getRange({ start: 0, end: 1000 });
        resultSet.forEach(function (result) {
            log.debug('result', result);
            lots.push({
                lotNumber: result.getValue("inventorynumber"),
                availableQty: parseFloat(result.getValue("quantityavailable")),
                sortRef: result.getValue(lotNumCol),
            });
        });
        lots.sort((a, b) => a.sortRef - b.sortRef);

        log.debug("Available Lots for item " + itemId, lots);
        return lots;
    }

    function gethbnocategory(itemid) {
        log.debug('gethbnocategory', itemid);
        var itemSearch = search.create({
            type: "item",
            filters: [["internalid", "anyof", itemid]],
            columns: [search.createColumn({ name: "cseg2" })]
        });

        var searchResult = itemSearch.run().getRange({ start: 0, end: 1 });
        if (searchResult.length > 0) {
            return searchResult[0].getText({ name: 'cseg2' });
        }
        return null;
    }
    
    function allocateLine(woRecord, line, availableLots, requiredQty) {
        log.debug('allocateLine');
        var remainingQty = requiredQty;
        woRecord.selectLine({ sublistId: 'item', line: line });

        var inventoryDetail = woRecord.getCurrentSublistSubrecord({
            sublistId: 'item',
            fieldId: 'inventorydetail'
        });

        if (!availableLots.length) return remainingQty; // No lots available

        for (var k = 0; k < availableLots.length; k++) {
            if (remainingQty <= 0) break;
            var qtyToAllocate = Math.min(remainingQty, availableLots[k].availableQty);
            remainingQty -= qtyToAllocate;

            inventoryDetail.selectNewLine({ sublistId: 'inventoryassignment' });
            inventoryDetail.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'receiptinventorynumber',
                value: availableLots[k].lotNumber
            });
            inventoryDetail.setCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'quantity',
                value: qtyToAllocate
            });
            inventoryDetail.commitLine({ sublistId: 'inventoryassignment' });
        }

        woRecord.commitLine({ sublistId: 'item' });
        return remainingQty;
    }

    
    function processWorkOrder(workOrderId, retryCount) {
        if (retryCount >= MAX_RETRIES) {
            // log.debug("Max retries reached for WO: " + workOrderId);
            return;
        }

        var woRecord = record.load({
            type: record.Type.WORK_ORDER,
            id: workOrderId,
            isDynamic: true
        });

        var woLineCount = woRecord.getLineCount({ sublistId: 'item' });
        var nextWorkOrders = []; 

        for (var j = 0; j < woLineCount; j++) {
            var itemId = woRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                line: j
            });
            log.debug(' wo itemid', itemId);
            var cseg2Val = gethbnocategory(itemId);
            log.debug('cseg2Val', cseg2Val);
            if (!cseg2Val || cseg2Val.indexOf("Raw Material") !== 0) continue;

            var requiredQty = woRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                line: j
            });

            var availableLots = getAvailableInventory(itemId);
            var remainingQty = allocateLine(woRecord, j, availableLots, requiredQty);

            if (remainingQty > 0) {
                // Get next WO ID FROM THE CURRENT WORK ORDER LINE
                var nextWOId = woRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'woid',
                    line: j
                });

                if (nextWOId) {
                    nextWorkOrders.push(nextWOId);
                    woRecord.setValue({ fieldId: 'custbody32', value: true }); 
                }
            }
        }

        // Save the current work order
        woRecord.save();

        // Process next work orders from failed lines
        nextWorkOrders.forEach(function(nextWOId) {
            processWorkOrder(nextWOId, retryCount + 1);
        });
    }

    return {
        afterSubmit: afterSubmit
    };
});