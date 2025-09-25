/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 *
 * @description
 * This script fetches Harmonized Tariff Schedule (HTS) data from the USITC endpoint,
 * decodes the Base64 response, and creates one custom record
 * (`customrecord_hbno_harmonized_tariff_sch`) per tariff entry.
 *
 * Each JSON object from the API response is processed in its own reduce stage.
 */

define(['N/https', 'N/encode', 'N/record', 'N/runtime', 'N/search'],
    (https, encode, record, runtime, search) => {


        /**
         * getInputData
         * Fetches the API response, decodes it, and returns an array of JSON objects.
         *
         * @returns {Array<Object>}
         */
        const getInputData = () => {
            try {
                // const URL = 'https://hts.usitc.gov/reststop/exportList?from=3301&to=3301.13.00.00&format=JSON&styles=true';
                //const URL = 'https://hts.usitc.gov/reststop/exportList?from=0000&to=0101&format=JSON&styles=true';

                let customrecord_hbno_global_configurationSearchObj = search.create({
                    type: "customrecord_hbno_global_configuration",
                    filters:
                        [
                            ["custrecord_hbno_gc_account_id", "is", runtime.accountId]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "custrecord_hbno_gc_hts_last_call",
                                label: "Harmonized Tariff Schedule Last Call"
                            })
                        ]
                });
                let fromParam;
                customrecord_hbno_global_configurationSearchObj.run().each(function (result) {
                    fromParam = result.getValue({name: 'custrecord_hbno_gc_hts_last_call'});
                });
                if (fromParam) {
                    // let toParam = '3301.13.00.00'; // you could also make this dynamic or another script param
                    //let toParam = '0101.21.00.20'; // you could also make this dynamic or another script param
                     let toParam = '9999999999999999'; // you could also make this dynamic or another script param

                    const URL = `https://hts.usitc.gov/reststop/exportList?from=${fromParam}&to=${toParam}&format=JSON&styles=true`;
                    log.audit('URL Called', URL);
                    let response = https.get({url: URL});

                    if (response.code === 200) {
                        // Response is Base64 because of "application/octet-stream"
                        let decoded = encode.convert({
                            string: response.body,
                            inputEncoding: encode.Encoding.BASE_64,
                            outputEncoding: encode.Encoding.UTF_8
                        });

                        let data = JSON.parse(decoded);
                        return data;
                    }
                } else {
                    log.error('HTTP error', `Status: ${response.code}, Body: ${response.body}`);
                    return [];
                }
            } catch (e) {
                log.error('getInputData error', e);
                return [];
            }
        };

        /**
         * map
         * Ensures each HTS object is passed individually to reduce.
         *
         * @param {Object} context
         */
        const map = (context) => {
            try {
                let item = JSON.parse(context.value); // context.value is a string
                context.write({
                    key: item.hnametsno || item.htsno || `no-code-${context.key}`,
                    value: JSON.stringify(item) // keep as string for reduce
                });
            } catch (e) {
                log.error('map error', e);
            }
        };

        /**
         * reduce
         * Creates a NetSuite custom record for each tariff entry.
         *
         * @param {Object} context
         */
        const reduce = (context) => {
            try {
                let item = JSON.parse(context.values[0]); // parse back to object
                log.debug('item', item)
                let values = {
                    name: item.hnametsno || item.htsno || '',
                    custrecord_hbno_tariff_indent: item.indent || '',
                    custrecord_hbno_article_description: item.description || '',
                    custrecord_hbno_tariff_superior: item.superior || '',
                    custrecord_hbno_unit_of_quantity: (item.units && item.units.length > 0) ? item.units.join(',') : '',
                    custrecord_hbno_tariff_general: item.general || '',
                    custrecord_hbno_section_1_special_code: item.special || '',
                    custrecord_hbno_tariff_section_2_other: item.other === 'Free' ? 0 : item.other,
                    externalid: item.htsno + '-' + item.indent + '-' + item.description.trim().replace(/\s+/g, '').substring(0, 20),
                    custrecord_hbno_tariff_special: (item.footnotes && item.footnotes.length > 0)
                        ? item.footnotes
                            .map(f => f.value.trim()
                                .replace(/^see\s+/i, '')   // removes "See " at the start, case-insensitive
                                .replace(/\.$/, '')        // removes final period
                            )
                            .join('; ')
                        : ''
                };

                //todo custrecord_hbno_tariff_special.replace(/^See\s*/, "").replace(/\.$/, "");

                let rec = record.create({
                    type: 'customrecord_hbno_harmonized_tariff_sch',
                    isDynamic: true
                });

                Object.keys(values).forEach(fieldId => {
                    if (values[fieldId]) {
                        try {
                            rec.setValue({
                                fieldId: fieldId,
                                value: values[fieldId]
                            });
                        } catch (e) {
                            log.debug(`Field not found or invalid: ${fieldId}`, e);
                        }
                    }
                });

                let recId = rec.save();
                log.debug('Record created', `ID: ${recId}`);

                // Emit htsno for summarize
                if (item.htsno) {
                    context.write({
                        key: 'htsno',
                        value: item.htsno
                    });
                }

            } catch (e) {
                log.error('reduce error', e);
            }
        };


        /**
         * Summarize stage: runs once at the end
         * Finds the greatest htsno (hierarchically) and updates script parameter
         */
        const summarize = (summary) => {
            try {
                let htsnos = [];

                summary.output.iterator().each((key, value) => {
                    if (key === 'htsno' && value) {
                        htsnos.push(value);
                    }
                    return true;
                });

                if (htsnos.length) {
                    // Sort hierarchically
                    htsnos.sort(compareHtsno);

                    let lastHtsno = htsnos[htsnos.length - 1];
                    log.debug('lastHtsno', lastHtsno)
                    log.debug(' runtime.accountId', runtime.accountId)

                    let customrecord_hbno_global_configurationSearchObj = search.create({
                        type: "customrecord_hbno_global_configuration",
                        filters:
                            [
                                ["custrecord_hbno_gc_account_id", "is", runtime.accountId]
                            ]
                    });
                    let hbnoGlobal;
                    customrecord_hbno_global_configurationSearchObj.run().each(function (result) {
                        hbnoGlobal = result.id;
                    });
                    if (hbnoGlobal)
                        record.submitFields({
                            type: 'customrecord_hbno_global_configuration',
                            id: hbnoGlobal,
                            values: {'custrecord_hbno_gc_hts_last_call': lastHtsno},
                            options: {enableSourcing: false, ignoreMandatoryFields: true}
                        });

                    log.audit('Summarize', `Updated last ID parameter to ${lastHtsno}`);
                } else {
                    log.audit('Summarize', 'No htsno processed, parameter not updated.');
                }
            } catch (e) {
                log.error('Summarize error', e);
            }
        };

        /**
         * Helper: compare htsno hierarchically (e.g., 33.10.10 > 33.10 > 3310)
         */
        function compareHtsno(a, b) {
            let pa = a.split('.');
            let pb = b.split('.');

            let len = Math.max(pa.length, pb.length);
            for (let i = 0; i < len; i++) {
                let ai = parseInt(pa[i] || '0', 10);
                let bi = parseInt(pb[i] || '0', 10);
                if (ai > bi) return 1;
                if (ai < bi) return -1;
            }
            return 0;
        }


        return {getInputData, map, reduce, summarize};
    });
