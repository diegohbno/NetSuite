/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record', 'N/log'], (search, record, log) => {

    const getInputData = () => {
        return search.load('customsearch4783');
    };

    const reduce = (context) => {
        const internalId = context.key;
        const recordType =JSON.parse(context.values[0]).recordType;
        log.debug('internalId', internalId)
        log.debug('recordType', recordType)

        try {
            const rec = record.load({
                type: recordType,
                id: internalId,
                isDynamic: false
            });

            const lineCount = rec.getLineCount({sublistId: 'item'});

            for (let i = 0; i < lineCount; i++) {
                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_hbno_discrepancy',
                    line: i,
                    value: false
                });

                rec.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol46',
                    line: i,
                    value: null
                });
            }

            rec.save({ignoreMandatoryFields: true});

            // Search for related CuTrSale102 records and update them
           /* var transactionSearchObj = search.create({
                type: "transaction",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["mainline","is","T"],
                        "AND",
                        ["type","anyof","CuTrSale102"],
                        "AND",
                        ["custbody_srp_createdfromsample_so","anyof",internalId]
                    ]
            });
            let shipID = [];

            transactionSearchObj.run().each(function(result){
                shipID.push(result.id);
                return true;
            });
            log.debug('shipID', shipID);

            // For each CuTrSale102 record, load and update item lines
            shipID.forEach(id => {
                try {
                    const shipRec = record.load({
                        type: 'customsale_srp_f3plo',
                        id: id,
                        isDynamic: false
                    });
                    const shipLineCount = shipRec.getLineCount({sublistId: 'item'});
                    for (let i = 0; i < shipLineCount; i++) {
                        shipRec.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_hbno_discrepancy',
                            line: i,
                            value: false
                        });
                        shipRec.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol46',
                            line: i,
                            value: null
                        });
                    }
                    shipRec.save({ignoreMandatoryFields: true});
                    log.audit('Updated CuTrSale102 Record', `ID: ${id}`);
                } catch (err) {
                    log.error('Error updating CuTrSale102 record', `ID: ${id}, Error: ${err}`);
                }
            });*/

            log.audit('Updated Record', `ID: ${internalId}, Type: ${recordType}`);

        } catch (error) {
            log.error('REDUCE ERROR', `ID: ${internalId}, Error: ${error}`);
        }
    };

    return {getInputData, reduce};
});
