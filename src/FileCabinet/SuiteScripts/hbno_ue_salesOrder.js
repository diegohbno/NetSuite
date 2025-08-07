/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/runtime'],
    (record, search, runtime) => {
        const MAX_RETRIES = 3; // Maximum number of recursive WO processing attempts

        // Caches to minimize repeated DB calls per execution
        const itemCategoryCache = {};
        const inventoryLotsCache = {};

        /**
         * Entry point for afterSubmit User Event.
         * @param {Object} context - NetSuite User Event context object.
         */
        const afterSubmit = (context) => {
            processSalesOrderAfterSubmit(context);
            log.debug('finish')
        };

        /**
         * Processes the Sales Order after submit event.
         * Loads the Sales Order, checks department/location, and processes related work orders.
         * @param {Object} context - The context object for the User Event.
         */
        const processSalesOrderAfterSubmit = (context) => {
            try {
                // Log the event type for debugging
                log.debug('context.type', `${context.type} - UE context: ${context.UserEventType.APPROVE}`);
                // Only process on CREATE or APPROVE events
                // if (![context.UserEventType.CREATE, context.UserEventType.APPROVE].includes(context.type)) return;

                // Load the Sales Order record
                const soRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: context.newRecord.id,
                    isDynamic: true
                });

                // Check department and location against script parameters
                const department = soRecord.getValue({fieldId: 'department'});
                const location = soRecord.getValue({fieldId: 'location'});
                const paramDept = runtime.getCurrentScript().getParameter({name: "custscript_hbno_ue_so_prvt_lbl_dptment"});
                const paramLoc = runtime.getCurrentScript().getParameter({name: "custscript_hbno_ue_so_loc_hbno_chico"});
                if (department !== paramDept || location !== paramLoc) return;

                // Gather all work order IDs from the Sales Order lines
                const lineCount = soRecord.getLineCount({sublistId: 'item'});
                const workOrderIds = [];
                for (let i = 0; i < lineCount; i++) {

                    const workOrderId = soRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'woid',
                        line: i
                    });

                    if (workOrderId) workOrderIds.push(workOrderId);
                }
                if (!workOrderIds.length) return;

                // Batch process all work orders
                workOrderIds.forEach(woId => processWorkOrder(woId, 0));
            } catch (e) {
                log.error("Error in processSalesOrderAfterSubmit", e.message);
            }
        };

        /**
         * Batch fetch item categories for a list of item IDs and populate cache.
         * @param {Array<string|number>} itemIds - Array of item internal IDs.
         */
        const batchGetItemCategories = (itemIds) => {
            const uncached = itemIds.filter(id => !(id in itemCategoryCache));
            if (!uncached.length) return;
            const itemSearch = search.create({
                type: "item",
                filters: [["internalid", "anyof", uncached]],
                columns: [search.createColumn({name: "internalid"}), search.createColumn({name: "cseg2"})]
            });
            const results = itemSearch.run().getRange({start: 0, end: 1000}) || [];
            results.forEach(res => {
                const id = res.getValue({name: "internalid"});
                itemCategoryCache[id] = res.getText({name: "cseg2"});
            });
        };

        /**
         * Batch fetch available inventory lots for a list of item IDs and populate cache.
         * @param {Array<string|number>} itemIds - Array of item internal IDs.
         */
        const batchGetAvailableInventory = (itemIds) => {
            const uncached = itemIds.filter(id => !(id in inventoryLotsCache));
            if (!uncached.length) return;
            const itemSearch = search.create({
                type: record.Type.INVENTORY_NUMBER,
                filters: [
                    ["item", "anyof", uncached],
                    "AND",
                    ["quantityavailable", "greaterthan", "0"]
                ],
                columns: [
                    search.createColumn({name: "item"}),
                    search.createColumn({
                        name: "formulanumeric",
                        formula: "CASE WHEN {inventorynumber} LIKE 'Lot:%' THEN TO_NUMBER(REPLACE({inventorynumber}, 'Lot: ', '')) ELSE TO_NUMBER({inventorynumber}) END",
                        sort: search.Sort.ASC
                    }),
                    search.createColumn({name: "inventorynumber"}),
                    search.createColumn({name: "quantityavailable"})
                ]
            });
            const results = itemSearch.run().getRange({start: 0, end: 1000}) || [];
            results.forEach(res => {
                const itemId = res.getValue({name: "item"});
                if (!inventoryLotsCache[itemId]) inventoryLotsCache[itemId] = [];
                inventoryLotsCache[itemId].push({
                    lotNumber: res.getValue({name: "inventorynumber"}),
                    availableQty: parseFloat(res.getValue({name: "quantityavailable"})),
                    sortRef: res.getValue({name: "formulanumeric"})
                });
            });
            // Sort each item's lots by lot number
            Object.keys(inventoryLotsCache).forEach(id => {
                inventoryLotsCache[id].sort((a, b) => a.sortRef - b.sortRef);
            });
        };

        /**
         * Get available inventory lots for an item from cache.
         * @param {string|number} itemId - Item internal ID.
         * @returns {Array<Object>} Array of lot objects.
         */
        const getAvailableInventory = (itemId) => inventoryLotsCache[itemId] || [];

        /**
         * Get HBNO category for an item from cache.
         * @param {string|number} itemid - Item internal ID.
         * @returns {string|null} Category value or null.
         */
        const gethbnocategory = (itemid) => itemCategoryCache[itemid] || null;

        /**
         * Allocates inventory lots to a work order line.
         * @param {Record} woRecord - The loaded work order record.
         * @param {number} line - The line number in the work order.
         * @param {Array<Object>} availableLots - Array of available lots.
         * @param {number} requiredQty - Quantity required for the line.
         * @returns {number} Remaining quantity not allocated.
         */
        const allocateLine = (woRecord, line, availableLots, requiredQty) => {
            let remainingQty = requiredQty;
            log.debug('woRecord',woRecord)
            log.debug('line',line)
            log.debug('availableLots',availableLots)
            log.debug('requiredQty',requiredQty)
            woRecord.selectLine({sublistId: 'item', line});
            // Get the inventory detail subrecord for the line
            const inventoryDetail = woRecord.getCurrentSublistSubrecord({
                sublistId: 'item',
                fieldId: 'inventorydetail'
            });
            log.debug('inventoryDetail',inventoryDetail)

            if (!availableLots.length) return remainingQty;
            for (const lot of availableLots) {
                log.debug('lot',lot)
                if (remainingQty <= 0) break;
                const qtyToAllocate = Math.min(remainingQty, lot.availableQty);
                log.debug('qtyToAllocate',qtyToAllocate)

                remainingQty -= qtyToAllocate;
                log.debug('remainingQty',remainingQty)

                // Assign lot to inventory assignment sublist
                inventoryDetail.selectNewLine({sublistId: 'inventoryassignment'});
                inventoryDetail.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'receiptinventorynumber',
                    value: lot.lotNumber
                });
                inventoryDetail.setCurrentSublistValue({
                    sublistId: 'inventoryassignment',
                    fieldId: 'quantity',
                    value: qtyToAllocate
                });
                inventoryDetail.commitLine({sublistId: 'inventoryassignment'});
            }
            woRecord.commitLine({sublistId: 'item'});

            return remainingQty;
        };

        /**
         * Processes a work order, allocating lots and handling next work orders if needed.
         * @param {number|string} workOrderId - The internal ID of the work order.
         * @param {number} retryCount - The current retry count for this work order chain.
         */
        const processWorkOrder = (workOrderId, retryCount) => {
            if (retryCount >= MAX_RETRIES) return;
            // Load the Work Order record
            const woRecord = record.load({
                type: record.Type.WORK_ORDER,
                id: workOrderId,
                isDynamic: true
            });
            log.debug('workOrderId',workOrderId)

            const woLineCount = woRecord.getLineCount({sublistId: 'item'});
            const itemIds = [];
            // Gather all unique item IDs from the WO lines
            for (let j = 0; j < woLineCount; j++) {
                const itemId = woRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: j
                });
                if (itemIds.indexOf(itemId) === -1) itemIds.push(itemId);
            }
            // Batch fetch categories and inventory for all items in this WO
            batchGetItemCategories(itemIds);
            batchGetAvailableInventory(itemIds);
            log.debug('woLineCount',woLineCount)

            const nextWorkOrders = [];
            for (let j = 0; j < woLineCount; j++) {
                const itemId = woRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: j
                });
                const cseg2Val = gethbnocategory(itemId);
                log.debug('cseg2Val',cseg2Val)

                // Only process lines with "Raw Material" category
                if (!cseg2Val || !cseg2Val.startsWith("Raw Material")) continue;
                const requiredQty = woRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: j
                });
                const availableLots = getAvailableInventory(itemId);

                const remainingQty = allocateLine(woRecord, j, availableLots, requiredQty);
                log.debug('remainingQty',remainingQty)

                // If not enough inventory, chain to next WO if available
                if (remainingQty > 0) {
                    const nextWOId = woRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'woid',
                        line: j
                    });
                    log.debug('nextWOId',nextWOId)
                    if (nextWOId)
                        nextWorkOrders.push(nextWOId);
                    woRecord.setValue({fieldId: 'custbody32', value: true});
                    woRecord.setValue({fieldId: 'custbody26', value: true});
                    const inventoryDetailSet = woRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'inventorydetailset',
                        line: j
                    });
                    if (!(inventoryDetailSet) && (!(nextWOId))) {
                        // Get the inventory detail subrecord for the line
                        woRecord.selectLine({sublistId: 'item', line: j});

                        woRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol1',
                            value: true
                        });
                        woRecord.commitLine({
                            sublistId: 'item'
                        });
                    }
                }
            }


            // Save the current work order
            let idWO = woRecord.save();
            // Recursively process next work orders if needed
            nextWorkOrders.forEach(nextWOId => {
                processWorkOrder(nextWOId, retryCount + 1);
            });
        };

        return {
            afterSubmit
        };
    });