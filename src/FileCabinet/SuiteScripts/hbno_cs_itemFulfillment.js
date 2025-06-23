/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/search', 'N/ui/message', 'N/currentRecord', 'N/record', 'N/url', 'N/https', 'N/runtime'],
    function (search, message, c, record, url, https, runtime) {
        /**
         * Native loading overlay utility.
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
            <div style="font-size:1.2em;margin-bottom:10px;">${text || 'Please wait...'}</div>
            <div class="loader" style="border: 6px solid #f3f3f3; border-top: 6px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
            <style>
                @keyframes spin { 100% { transform: rotate(360deg); } }
            </style>
        `;
            document.body.appendChild(overlay);
        }

        function hideLoadingOverlay() {
            let overlay = document.getElementById('custom-loading-overlay');
            if (overlay) overlay.remove();
        }

        /**
         * Standard NetSuite pageInit.
         */
        const pageInit = (context) => {
            log.debug('page init', context);
        };

        /**
         * Creates a 3PL consignment by calling a Suitelet and redirects to the Release Order.
         * Shows a native loading overlay and uses alert for errors.
         * @param {string|number} id - The current record ID.
         */
        const create_3pl_consignment = (id) => {
            try {
                showLoadingOverlay('Please wait...');
                let currentRecords = c.get();
                let recordId = currentRecords.id;
                log.debug('record id', recordId);

                const suiteletUrl = url.resolveScript({
                    scriptId: 'customscript_hbno_sl_create_3pl_cnsgnmt',
                    deploymentId: 'customdeploy_hbno_sl_create_3pl_cnsgnmt',
                    params: {
                        recordId: recordId
                    }
                });

                log.debug('Suitelet URL', suiteletUrl);

                jQuery.ajax({
                    url: suiteletUrl,
                    method: 'GET',
                    success: function (response) {
                        hideLoadingOverlay();
                        log.debug('Suitelet Response', response);

                        let responseBody;
                        try {
                            responseBody = JSON.parse(response);
                        } catch (parseErr) {
                            log.error('Parse Error', parseErr);
                            alert('Unexpected response from Suitelet. Please try again or contact support.');
                            return;
                        }

                        if (responseBody && responseBody.success) {
                            const releaseOrderId = responseBody.releaseOrderId;
                            log.debug('Redirecting to Release Order', releaseOrderId);

                            // Use runtime to get the correct NetSuite domain, replacing '_' with '-'
                            const accountId = runtime.accountId ? runtime.accountId.toLowerCase().replace(/_/g, '-') : '';
                            const baseUrl = accountId ? `https://${accountId}.app.netsuite.com` : '';
                            const releaseOrderUrl = `${baseUrl}/app/accounting/transactions/cutrsale.nl?id=${releaseOrderId}&customtype=103&whence=`;
                            window.location.href = releaseOrderUrl;
                        } else {
                            const msg = responseBody && responseBody.message ? responseBody.message : 'Unknown error';
                            log.error('Failed to create release order', msg);
                            alert('Failed to create release order: ' + msg);
                        }
                    },
                    error: function (jqXHR, textStatus, errorThrown) {
                        hideLoadingOverlay();
                        log.error('Suitelet Call Failed', textStatus + ': ' + errorThrown);
                        alert('Error calling Suitelet: ' + textStatus);
                    }
                });
            } catch (e) {
                hideLoadingOverlay();
                log.debug('Exception', e);
                alert('Unexpected error: ' + (e.message || e));
            }
        };

        return {
            pageInit: pageInit,
            create_3pl_consignment: create_3pl_consignment
        };
    });