/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author
 * @description Adds a custom button on the fulfillment record view, only if certain conditions are met.
 */

define(['N/record', 'N/log'], (record, log) => {

    /**
     * beforeLoad User Event
     * Triggered before the record form is loaded.
     * Adds a "3PL Consignment" button on the Item Fulfillment if:
     * - The record is being viewed (not edited/created)
     * - The custom field "custbody_created_form" is empty
     * - The shipping status is "C" (Shipped/Completed)
     *
     * @param {UserEventContext} context - The context object for the User Event script.
     */
    const beforeLoad = (context) => {
        try {
            if (context.type === context.UserEventType.VIEW) {
                addConsignmentButton(context);
            }
        } catch (e) {
            log.error('Error in beforeLoad', e);
        }
    };

    /**
     * Adds the "3PL Consignment" button if criteria are met.
     *
     * @param {UserEventContext} context
     */
    const addConsignmentButton = (context) => {
        const { newRecord, form } = context;
        const recordId = newRecord.id;

        // Check if this record was created from a 3PL consignment (custom logic)
        const consignment3pl = newRecord.getValue('custbody_created_form');
        log.debug('consignment3pl value', consignment3pl);

        // Check the shipping status
        const status = newRecord.getValue('shipstatus');
        log.debug('status value', status);

        // Only show the button if there's no source consignment and status is "C"
        if (!consignment3pl && status === 'C') {
            form.addButton({
                id: 'custpage_3pl_consignment',
                label: '3PL Consignment',
                functionName: `create_3pl_consignment("${recordId}")`
            });

            form.clientScriptModulePath = '../client/srp_hbno_3pl_consignment_cs.js';
            log.debug('User Event', '3PL Consignment button added');
        }
    };

    return {
        beforeLoad
    };
});
