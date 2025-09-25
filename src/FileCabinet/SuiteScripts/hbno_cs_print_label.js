/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @description Client Script for calling a Suitelet to generate labels for items.
 *              Shows a loading overlay while the Suitelet processes the request,
 *              then refreshes the page when completed.
 */
define(['N/url'],
    function(url) {

    /**
     * Shows a full-page loading overlay with an optional message.
     * @param {string} text - The message to display on the overlay.
     */
    function showLoadingOverlay(text) {
        let overlay = document.createElement('div');
        overlay.id = 'custom-loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(255,255,255,0.7)';
        overlay.style.zIndex = 9999;
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.innerHTML = `
            <div style="font-size:1.2em;margin-bottom:10px;">${text || 'Generating labels...'}</div>
            <div class="loader" style="border: 6px solid #f3f3f3; border-top: 6px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
            <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
        `;
        document.body.appendChild(overlay);
    }

    /**
     * Hides the loading overlay if it exists.
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('custom-loading-overlay');
        if (overlay) overlay.remove();
    }

    /**
     * Calls the Suitelet to generate all labels for a record and waits until it's done.
     * @param {number|string} id - Internal ID of the record.
     * @param {string} type - Record type (e.g., 'itemreceipt').
     */
    const attach_label = async (id, type) => {
        try {
            // Show overlay while processing
            showLoadingOverlay('Generating labels...');

            // Build the Suitelet URL with parameters
            const suiteletUrl = url.resolveScript({
                scriptId: 'customscript_hbno_sl_print_label',
                deploymentId: 'customdeploy_hbno_sl_print_label',
                params: { recordId: id, recordType: type }
            });

            // Call Suitelet and wait for response
            const response = await fetch(suiteletUrl, { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Suitelet Error: ${response.status} ${response.statusText}`);
            }

            // Log Suitelet response for debugging
            const data = await response.text();
            console.log('Suitelet finished:', data);

            // Reload the page to display updated links
            location.reload();

        } catch (error) {
            console.error('Error generating labels:', error);
            alert('Error generating labels: ' + error.message);
        } finally {
            // Hide overlay when done
            hideLoadingOverlay();
        }
    };

    /**
     * pageInit function placeholder.
     * Currently empty, ready for future logic if needed.
     * @param {Object} context - The page context object.
     */
    function pageInit(context) {
        // Intentionally left blank
    }

    return {
        attach_label,
        pageInit
    };
});
