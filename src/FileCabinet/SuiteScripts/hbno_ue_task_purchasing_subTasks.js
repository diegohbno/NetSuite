/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * @description
 * User Event that injects a button into the form on VIEW mode.
 * The button opens a popup (Suitelet) to create purchasing sub-tasks.
 */
define([], () => {

    /**
     * beforeLoad User Event.
     *
     * @param {Object} context - The context object.
     * @param {Form} context.form - The current form.
     * @param {Record} context.newRecord - The record being loaded.
     * @param {string} context.type - The operation type (CREATE, EDIT, VIEW, etc.).
     */
    const beforeLoad = (context) => {
        try {
            // Only add the button in VIEW mode
            if (context.type !== context.UserEventType.VIEW) {
                return;
            }

            const form = context.form;

            // Attach client script that will handle the popup
            form.clientScriptModulePath = 'SuiteScripts/hbno_cs_task_purchasing_subTasks.js';

            // Add a custom button to open the Suitelet popup
            form.addButton({
                id: 'custpage_open_popup',
                label: 'BULK Create RFQ Drafts',
                functionName: 'openPopup'
            });

            log.debug('beforeLoad', 'Button added successfully');
        } catch (error) {
            log.error('Error in beforeLoad', error);
        }
    };

    return { beforeLoad };
});
