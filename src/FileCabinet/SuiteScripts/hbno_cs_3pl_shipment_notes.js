/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord'],
    (currentRecord) => {

        /**
         * Triggered before the record is saved.
         * Calls validation to ensure line item quantities do not exceed remaining quantities.
         *
         * @returns {boolean} - Return false to prevent record submission.
         */
        const saveRecord = () => {
            const rec = currentRecord.get();

            // If the record has no ID, it's in Create mode
            const isCreateMode = !rec.id;

            if (isCreateMode) {
                return validateQuantitiesBeforeSave();
            }

            // Allow save without validation if not in Create mode
            return true;
        };

        /**
         * Validates that no item line has quantity greater than the remaining quantity.
         *
         * @returns {boolean} - Returns true if all lines are valid; false otherwise.
         */
        const validateQuantitiesBeforeSave = () => {
            const rec = currentRecord.get();
            const lineCount = rec.getLineCount({sublistId: 'item'});

            for (let i = 0; i < lineCount; i++) {
                const qty = parseFloat(rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i,
                })) || 0;

                const remaining = parseFloat(rec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_srp_3pl_remaining_qty',
                    line: i,
                })) || 0;

                // If quantity entered is greater than remaining, prevent submission
                if (qty > remaining) {
                    alert(`Line ${i + 1}: Quantity (${qty}) exceeds Remaining (${remaining}).`);
                    return false;
                }
            }

            return true;
        };

        return {
            saveRecord
        };
    });
