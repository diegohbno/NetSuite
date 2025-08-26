/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * @description
 * Map/Reduce script that updates the Fix Inventory Adjustment (custbody_fix_inventory_adjustment)
 * by adding a new line for each Sales Order with pending quantities.
 * It ensures pending Shipment Notes can be fulfilled by allocating the target Bin with the largest available quantity.
 */

define(['N/search', 'N/record', 'N/log'],
    (search, record, log) => {

        /**
         * getInputData
         * Load the saved search customsearch5104, which returns Sales Orders
         * with a Fix Inventory Adjustment but not fully shipped.
         */
        const getInputData = () => {
            log.debug('getInputData', 'Loading saved search customsearch5115');
            return search.load({id: 'customsearch5115'});
        };




        const reduce = (context) => {
            try {
                // context.key is the internalid of the customsale_srp_f3plo record
                const f3ploId = context.key;
                log.debug('reduce', `Processing customsale_srp_f3plo id: ${f3ploId}`);

                // context.value is a JSON string with the search result
                const result = JSON.parse(context.values[0]);
                log.debug('reduce', `Result object: ${JSON.stringify(result)}`);

                // Get createdfrom.value from the search result
                const createdFrom = result.values.createdfrom?.value;
                log.debug('reduce', `createdfrom.value: ${createdFrom}`);

                if (createdFrom) {
                    // Load the customsale_srp_f3plo record
                    const f3ploRec = record.load({
                        type: 'customsale_srp_f3plo',
                        id: f3ploId,
                        isDynamic: false
                    });
                    log.debug('reduce', `Loaded customsale_srp_f3plo record: ${f3ploId}`);

                    // Set createdfrom in custbodycustbody159
                    f3ploRec.setValue({
                        fieldId: 'custbodycustbody159',
                        value: createdFrom
                    });
                    log.debug('reduce', `Set custbodycustbody159 to ${createdFrom}`);

                    // Save the record
                    const savedId = f3ploRec.save();
                    log.debug('reduce', `Saved customsale_srp_f3plo record: ${savedId}`);
                } else {
                    log.debug('reduce', `No createdfrom value for customsale_srp_f3plo id: ${f3ploId}`);
                }
            } catch (e) {
                log.error('reduce error', e);
            }
        };

        const summarize = (summary) => {
            log.audit('summarize', 'Script completed');

        };

        return {getInputData, reduce, summarize};
    });
