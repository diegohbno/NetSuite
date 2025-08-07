/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * Client Script to backup and re-add all Inventory Detail lines on page init.
 */

define(['N/currentRecord'], (currentRecordModule) => {
    /**
     * On page init, backup all inventory detail lines (serial/lot number, bin, status, quantity),
     * remove all lines, and re-add them.
     * @param {Object} context - The page init context.
     */
    function pageInit(context) {
        try {
            const sublistId = 'inventoryassignment';
            const currentRecord = currentRecordModule.get();
            const lineCount = currentRecord.getLineCount({ sublistId });

            // Backup all lines
            const lines = [];
            for (let i = 0; i < lineCount; i++) {
                lines.push({
                    serialLot: currentRecord.getSublistValue({ sublistId, fieldId: 'issueinventorynumber', line: i }),
                    bin: currentRecord.getSublistValue({ sublistId, fieldId: 'binnumber', line: i }),
                    status: currentRecord.getSublistValue({ sublistId, fieldId: 'inventorystatus', line: i }),
                    quantity: currentRecord.getSublistValue({ sublistId, fieldId: 'quantity', line: i })
                });
            }
            console.log('lineCount: ' + lineCount)

            // Remove all lines (from last to first)
            for (let i = lineCount - 1; i >= 0; i--) {
                currentRecord.removeLine({ sublistId, line: i });
            }
            console.log('lines: ' + JSON.stringify(lines))

            // Helper to wait for ms milliseconds
            function wait(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            // Re-add all lines with a delay after setting serial/lot number
            (async function reAddLines() {
                for (const line of lines) {
                    console.log('line: ' + JSON.stringify(line))

                    currentRecord.selectNewLine({ sublistId });
                    currentRecord.setCurrentSublistValue({ sublistId, fieldId: 'issueinventorynumber', value: line.serialLot });
                    await wait(1000); // Wait 1 second before setting the next field
                    currentRecord.setCurrentSublistValue({ sublistId, fieldId: 'binnumber', value: line.bin });
                    currentRecord.setCurrentSublistValue({ sublistId, fieldId: 'inventorystatus', value: line.status });
                    console.log('1: ')

                    currentRecord.setCurrentSublistValue({ sublistId, fieldId: 'quantity', value: Math.abs(line.quantity) });
                    console.log('2: ')

                    currentRecord.commitLine({ sublistId });
                }
            })();
        } catch (e) {
            console.log('Error backing up and restoring Inventory Detail lines:', e);
        }
    }

    return {
        pageInit
    };
});
