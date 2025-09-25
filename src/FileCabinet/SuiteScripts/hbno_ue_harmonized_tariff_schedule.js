/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 *
 * @description
 * After a record of type `customrecord_hbno_harmonized_tariff_sch` is submitted,
 * this script checks if the current record’s `name` (e.g., 0102.29.20.11) has
 * a parent record (e.g., 0102.29.20 → 0102.29 → 0102).
 *
 * If found, it copies tariff-related fields from the closest parent that has values
 * into the current record.
 */

define(['N/record', 'N/search'], (record, search) => {

    /**
     * Fields to copy from parent to child.
     * @type {string[]}
     */
    const FIELDS_TO_COPY = [
        'custrecord_hbno_tariff_general',
        'custrecord_hbno_tariff_special',
        'custrecord_hbno_section_1_special_code',
        'custrecord_hbno_tariff_section_2_other'
    ];

    /**
     * Search for a parent record with the given code.
     *
     * @param {string} code - The "name" value of the parent record (e.g., 0102.29.20).
     * @returns {search.Result|null} - The search result if found, otherwise null.
     */
    const findParentRecord = (code) => {
        log.debug('Searching parent record', code);

        const searchObj = search.create({
            type: 'customrecord_hbno_harmonized_tariff_sch',
            filters: [['name', 'is', code]],
            columns: FIELDS_TO_COPY.map(f => search.createColumn({ name: f }))
        });

        const result = searchObj.run().getRange({ start: 0, end: 1 });

        if (result && result.length > 0) {
            log.debug('Parent record found', { code, internalId: result[0].id });
            return result[0];
        }

        log.debug('No parent record found', code);
        return null;
    };

    /**
     * Get values from the closest parent that has data populated.
     *
     * @param {string} name - Current record’s name (e.g., 0102.29.20.11).
     * @returns {Object} - An object with populated field values, or empty if none found.
     */
    const getInheritedValues = (name) => {
        log.debug('Building hierarchy from name', name);

        let valuesToSet = {};
        let hierarchy = [];

        if (name && name.includes('.')) {
            const parts = name.split('.');
            while (parts.length > 1) {
                parts.pop();
                hierarchy.push(parts.join('.'));
            }
        }

        log.debug('Generated hierarchy', hierarchy);

        // Search parent records in order (closest first)
        for (let parentCode of hierarchy) {
            let parent = findParentRecord(parentCode);
            if (parent) {
                let hasValues = false;
                FIELDS_TO_COPY.forEach(f => {
                    const val = parent.getValue({ name: f }); // ✅ fixed
                    log.debug(`Checking field ${f}`, val);
                    if (val) {
                        valuesToSet[f] = val;
                        hasValues = true;
                    }
                });
                if (hasValues) {
                    log.debug('Values found in parent', { parentCode, values: valuesToSet });
                    break; // stop at the first parent with values
                }
            }
        }

        if (Object.keys(valuesToSet).length === 0) {
            log.debug('No inherited values found for', name);
        }

        return valuesToSet;
    };

    /**
     * AfterSubmit entry point.
     *
     * @param {UserEventContext.afterSubmit} context
     */
    const afterSubmit = (context) => {
        try {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }

            const rec = context.newRecord;
            const recId = rec.id;
            const recType = rec.type;
            const name = rec.getValue('name');

            log.debug('Processing record', { recType, recId, name });

            if (!name) return;

            // Get inherited values
            const valuesToSet = getInheritedValues(name);

            // Update record if values were found
            if (Object.keys(valuesToSet).length > 0) {
                log.debug('Updating record with inherited values', valuesToSet);
                record.submitFields({
                    type: recType,
                    id: recId,
                    values: valuesToSet,
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });
            } else {
                log.debug('No values to update for record', recId);
            }

        } catch (e) {
            log.error('Error in afterSubmit', e);
        }
    };

    return { afterSubmit };
});
