/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 *
 * @description
 * Client Script that opens a Suitelet in a popup to create purchasing sub-tasks.
 */
define(['N/url', 'N/currentRecord'], (url, currentRecord) => {

    /**
     * Opens the Suitelet in a popup window.
     */
    const openPopup = () => {
        try {
            const rec = currentRecord.get();

            if (!rec || !rec.id || !rec.type) {
                console.log('No valid record found to pass as parameters.');
                return;
            }

            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_hbno_sl_create_subtasks',
                deploymentId: 'customdeploy_hbno_sl_create_subtasks',
                params: {
                    recordId: rec.id,
                    recordType: rec.type
                }
            });

            // Open Suitelet in popup
            window.open(
                suiteletUrl,
                'popup',
                'width=1400,height=1000,scrollbars=yes,resizable=yes'
            );

            console.log('Popup opened successfully for record:', rec.id);
        } catch (error) {
            console.error('Error opening popup:', error);
        }
    };

    /**
     * Page init entry point.
     *
     * @param {Object} context - The context object
     */
    const pageInit = (context) => {
    };

    return { openPopup, pageInit };
});
