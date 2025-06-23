/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @description Merged client script for 3PL shipment note, quantity restriction, and cancel override.
 */
define([
    'N/currentRecord', 'N/record', 'N/ui/dialog', 'N/url', 'N/search', 'N/runtime'
], function (currentRecord, record, dialog, url, search, runtime) {

    // --- Cancel Button Override Logic ---
    let isOverridden = false;
    let observer = null;
    let retryCount = 0;
    const MAX_RETRIES = 20;

    /**
     * Initializes the cancel button override after page load.
     * @param {Object} context - NetSuite pageInit context.
     */
    function pageInit(context) {
        setTimeout(() => {
            initializeCancelOverride();
            removeZero3PLQuantityLines(context.currentRecord);
        }, 100);
    }

    /**
     * Observes DOM mutations and attempts to override the cancel button.
     */
    function initializeCancelOverride() {
        if (overrideCancelButton()) return;
        startObserving();
        const retryInterval = setInterval(() => {
            retryCount++;
            if (isOverridden || retryCount >= MAX_RETRIES) {
                clearInterval(retryInterval);
                return;
            }
            overrideCancelButton();
        }, 250);
    }

    function startObserving() {
        if (observer) return;
        observer = new MutationObserver((mutations) => {
            if (isOverridden) return;
            let shouldCheck = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE &&
                            (node.id === '_cancel' || (node.querySelector && node.querySelector('#_cancel')))) {
                            shouldCheck = true;
                        }
                    });
                }
            });
            if (shouldCheck) setTimeout(overrideCancelButton, 50);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Attempts to override the cancel button's behavior.
     * @returns {boolean}
     */
    function overrideCancelButton() {
        try {
            let cancelButton = document.getElementById('_cancel') ||
                document.querySelector('input[id="_cancel"]') ||
                document.querySelector('input[value="Cancel"]') ||
                document.querySelector('a[onclick*="cancel"]') ||
                document.querySelector('input[onclick*="cancel"]');
            if (!cancelButton) return false;
            if (cancelButton.hasAttribute('data-custom-override')) {
                isOverridden = true;
                return true;
            }
            cancelButton.setAttribute('data-custom-override', 'true');
            const originalOnClick = cancelButton.onclick;
            const originalHref = cancelButton.href;
            cancelButton.onclick = function (e) {
                handleCancelClick(e, originalOnClick, originalHref);
            };
            cancelButton.addEventListener('click', function (e) {
                if (!e.defaultPrevented) handleCancelClick(e, originalOnClick, originalHref);
            }, true);
            isOverridden = true;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Handles the cancel button click event.
     */
    function handleCancelClick(event, originalOnClick, originalHref) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleCustomCancel(originalOnClick, originalHref);
    }

    /**
     * Custom cancel logic: confirm and delete record if needed.
     */
    async function handleCustomCancel(originalOnClick, originalHref) {
        try {
            const rec = currentRecord.get();
            if (!rec) return executeOriginalCancel(originalOnClick, originalHref);
            const recordId = rec.id;
            const recordType = rec.type;
            const inventoryAdjustment = rec.getValue({ fieldId: 'custbody_srp_linked_inventory_adj' });
            const releaseOrder = rec.getValue({ fieldId: 'custbodycustbody159' });
            if (recordId && !inventoryAdjustment) {
                const confirmed = await dialog.confirm({
                    title: 'Confirm Cancel',
                    message: 'If you cancel, all unsaved data will be lost. Do you still want to cancel?'
                });
                if (confirmed) {
                    try {
                        await record.delete({ type: recordType, id: recordId });
                        handlePostDeleteNavigation(releaseOrder);
                    } catch (deleteError) {
                        await dialog.alert({
                            title: 'Delete Error',
                            message: 'Failed to delete record: ' + (deleteError.message || deleteError.toString())
                        });
                    }
                }
            } else {
                executeOriginalCancel(originalOnClick, originalHref);
            }
        } catch (error) {
            executeOriginalCancel(originalOnClick, originalHref);
        }
    }

    /**
     * Handles navigation after record deletion.
     */
    function handlePostDeleteNavigation(releaseOrder) {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        if (releaseOrder) {
            try {
                const recordUrl = url.resolveRecord({
                    recordType: 'salesorder',
                    recordId: releaseOrder,
                    isEditMode: false
                });
                window.location.href = recordUrl;
                return;
            } catch {
                window.location.href = '/app/accounting/transactions/salesord.nl?id=' + releaseOrder;
                return;
            }
        }
        window.location.href = '/app/common/search/searchresults.nl';
    }

    /**
     * Executes the original cancel button behavior.
     */
    function executeOriginalCancel(originalOnClick, originalHref) {
        if (originalOnClick) {
            originalOnClick.call(document.getElementById('_cancel'));
        } else if (originalHref) {
            window.location.href = originalHref;
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = '/app/center/card.nl';
        }
    }

    function pageUnload() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    // --- 3PL Quantity Restriction Logic ---

    /**
     * Removes lines with 0 in 'custcol_srp_3pl_quantity' on pageInit.
     * @param {Object} rec - NetSuite currentRecord object.
     */
    function removeZero3PLQuantityLines(rec) {
        try {
            const lineCount = rec.getLineCount({ sublistId: 'item' });
            for (let r = lineCount - 1; r >= 0; r--) {
                rec.selectLine({ sublistId: 'item', line: r });
                const quantity3pl = rec.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_srp_3pl_quantity'
                });
                if (quantity3pl == 0) {
                    rec.removeLine({
                        sublistId: 'item',
                        line: r,
                        ignoreRecalc: true
                    });
                }
            }
        } catch (e) {
            // Ignore errors on pageInit
        }
    }

    /**
     * Restricts item line quantity to not exceed 3PL quantity.
     * @param {Object} context - NetSuite fieldChanged context.
     */
    function fieldChanged(context) {
        try {
            const { currentRecord, fieldId } = context;
            if (fieldId === 'quantity') {
                const quantity = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity'
                });
                const quantityRecive = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_srp_3pl_quantity'
                });
                if (quantity > quantityRecive) {
                    alert('Quantity must be less than or equal to Release order total quantity');
                    currentRecord.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: '',
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                    });
                }
            }
        } catch (e) {
            // Ignore fieldChanged errors
        }
    }

    /**
     * Validates all item lines for quantity and bin/lot availability before save.
     * @param {Object} context - NetSuite saveRecord context.
     * @returns {boolean}
     */
    function saveRecord(context) {
        const rec = context.currentRecord;
        const lineCount = rec.getLineCount({ sublistId: 'item' });
        const location = rec.getValue({ fieldId: 'location' });
        const inventoryAdjustmentId = rec.getValue({ fieldId: 'custbody_srp_linked_inventory_adj' });

        for (let i = 0; i < lineCount; i++) {
            rec.selectLine({ sublistId: 'item', line: i });
            const quantity = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity' });
            const quantityRecive = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_srp_3pl_quantity' });
            if (quantity > quantityRecive) {
                alert('Quantity must be less than or equal to Release order total quantity');
                return false;
            }
            // Inventory detail validation
            const itemId = rec.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' });
            const inventoryDetailSubrecord = rec.getCurrentSublistSubrecord({
                sublistId: 'item',
                fieldId: 'inventorydetail'
            });
            if (inventoryDetailSubrecord && exceedsBinLotQuantity(inventoryDetailSubrecord, itemId, location, inventoryAdjustmentId)) {
                dialog.alert({
                    title: 'Quantity Exceed',
                    message: 'The entered quantity exceeds the available bin quantity'
                });
                return false;
            }
        }
        return true;
    }

    /**
     * Checks if any inventory assignment line exceeds available bin/lot quantity.
     * @param {Object} inventoryDetailSubrecord
     * @param {string|number} item
     * @param {string|number} location
     * @param {string|number} inventoryAdjustmentId
     * @returns {boolean}
     */
    function exceedsBinLotQuantity(inventoryDetailSubrecord, item, location, inventoryAdjustmentId) {
        const inventoryLineCount = inventoryDetailSubrecord.getLineCount({ sublistId: 'inventoryassignment' });
        for (let j = 0; j < inventoryLineCount; j++) {
            inventoryDetailSubrecord.selectLine({ sublistId: 'inventoryassignment', line: j });
            const binNumber = inventoryDetailSubrecord.getCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'binnumber',
                line: j
            });
            let lotNumber = inventoryDetailSubrecord.getCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'issueinventorynumber',
                line: j
            });
            lotNumber = lotIdToName(lotNumber);
            const quantity = inventoryDetailSubrecord.getCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'quantity',
                line: j
            });
            const lotquantityValue = getLotQuantity(lotNumber, binNumber, location, item, inventoryAdjustmentId);
            if (lotquantityValue < quantity || lotquantityValue === null) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gets available quantity for a lot/bin/location/item, including inventory adjustment.
     */
    function getLotQuantity(lotNumber, binNumber, location, item, inventoryAdjustmentId) {
        let value = null;
        const itemSearchObj = search.create({
            type: "item",
            filters: [
                ["internalid", "anyof", item],
                "AND",
                ["inventorynumberbinonhand.binnumber", "anyof", binNumber],
                "AND",
                ["inventorynumberbinonhand.inventorynumber", "is", lotNumber],
                "AND",
                ["inventorynumberbinonhand.location", "anyof", location]
            ],
            columns: [
                search.createColumn({ name: "quantityavailable", join: "inventoryNumberBinOnHand" })
            ]
        });
        itemSearchObj.run().each(function (result) {
            let available = result.getValue({ name: "quantityavailable", join: "inventoryNumberBinOnHand" });
            let lotNumberId = result.getValue({ name: "inventorynumber", join: "inventoryNumberBinOnHand" });
            let adjustmentQuantity = getInventoryAdjustmentQuantity(inventoryAdjustmentId, item, lotNumberId, binNumber);
            value = parseFloat(available || 0) + parseFloat(adjustmentQuantity || 0);
            return false; // Only need the first result
        });
        return value;
    }

    /**
     * Gets inventory adjustment quantity for a given lot/bin/item.
     */
    function getInventoryAdjustmentQuantity(inventoryAdjustmentId, item, lotNumber, binNumber) {
        let value = 0;
        if (inventoryAdjustmentId) {
            const inventoryadjustmentSearchObj = search.create({
                type: "inventoryadjustment",
                filters: [
                    ["type", "anyof", "InvAdjst"],
                    "AND",
                    ["internalid", "anyof", inventoryAdjustmentId],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["item", "anyof", item],
                    "AND",
                    ["inventorydetail.binnumber", "anyof", binNumber],
                    "AND",
                    ["inventorydetail.inventorynumber", "anyof", lotNumber]
                ],
                columns: [
                    search.createColumn({ name: "quantity", join: "inventoryDetail" })
                ]
            });
            inventoryadjustmentSearchObj.run().each(function (result) {
                let quantity = result.getValue({ name: "quantity", join: "inventoryDetail" });
                value = parseFloat(quantity || 0);
                return false;
            });
        }
        return value;
    }

    /**
     * Converts lot internal ID to lot name.
     */
    function lotIdToName(lotId) {
        let value = null;
        if (lotId) {
            const lotnumberSearchObj = search.create({
                type: "inventorynumber",
                filters: [["internalid", "anyof", lotId]],
                columns: [search.createColumn({ name: "inventorynumber" })]
            });
            lotnumberSearchObj.run().each(function (result) {
                value = result.getValue({ name: "inventorynumber" });
                return false;
            });
        }
        return value;
    }

    // --- Exports ---
    return {
        pageInit,
        pageUnload,
        fieldChanged,
        saveRecord
    };
});
