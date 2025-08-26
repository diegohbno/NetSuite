/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    /**
     * getInputData
     * Loads a saved search and returns its results as input.
     */
    const getInputData = () => {
        try {
            return search.load({
                id: 'customsearch_hbno_3pl_all_shipment_note' // Replace with your saved search ID
            });
        } catch (e) {
            log.error({
                title: 'Error in getInputData',
                details: e
            });
        }
    };

    /**
     * reduce
     * For each key (recordId) received, load and save the record.
     */
    const reduce = (context) => {
        try {
            log.debug('context',context)
            const recordId = JSON.parse(context.values[0]).id;
            log.debug('Processing record', recordId);

            let rec = record.load({
                type: 'customsale_srp_f3plo', // Replace with your record type
                id: recordId
            });

            // You can modify the record here before saving
            rec.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            log.audit('Record saved', recordId);

        } catch (e) {
            log.error({
                title: `Error processing record ID ${recordId}`,
                details: e
            });
        }

    };

    /**
     * summarize
     * Final log with process info.
     */
    const summarize = (summary) => {
        log.audit('Summary', {
            usage: summary.usage,
            concurrency: summary.concurrency,
            yields: summary.yields
        });

        summary.reduceSummary.errors.iterator().each((key, error) => {
            log.error({
                title: `Error in reduce with key ${key}`,
                details: error
            });
            return true;
        });
    };

    return {
        getInputData,
        reduce,
        summarize
    };

});
