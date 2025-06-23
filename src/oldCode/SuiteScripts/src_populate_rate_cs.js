/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/record', 'N/search'], function (record, search) {

    function saveRecord(context) {
        const currentRecord = context.currentRecord;
        const lineCount = currentRecord.getLineCount({ sublistId: 'item' });

        // Loop through each line of the item sublist
        for (let i = 0; i < lineCount; i++) {
            const custcol_srp_ppkb = currentRecord.getSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_srp_ppkb',
                line: i
            });

            if (custcol_srp_ppkb) {
                const itemId = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: i
                });
                const itemtype = currentRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'itemtype',
                    line: i
                });

                log.debug('Itemtype', itemtype);

                // Determine the item record type based on itemtype field
                let recordType;
                switch (itemtype) {
                    case 'Assembly':
                        recordType = record.Type.ASSEMBLY_ITEM;
                        break;
                    case 'Inventory':
                        recordType = record.Type.INVENTORY_ITEM;
                        break;
                    case 'NonInvtPart':
                        recordType = record.Type.NON_INVENTORY_ITEM;
                        break;
                    case 'Service':
                        recordType = record.Type.SERVICE_ITEM;
                        break;
                    case 'OtherCharge':
                        recordType = record.Type.OTHER_CHARGE_ITEM;
                        break;
                    case 'Kit':
                        recordType = record.Type.KIT_ITEM;
                        break;
                    // Add more cases as needed for other item types
                    default:
                        log.error('Unsupported Item Type', itemtype);
                        continue;
                }

                // Load the item record dynamically based on recordType
                const itemRecord = record.load({
                    type: recordType,
                    id: itemId
                });

                const itemCustcol24 = itemRecord.getValue({
                    fieldId: 'custitem_srp_ekg' // Assuming custitem92 is the field you need
                });

                if (itemCustcol24) {
                    const calculatedRate = custcol_srp_ppkb * itemCustcol24;

                    // Select the line in the sublist to update
                    currentRecord.selectLine({
                        sublistId: 'item',
                        line: i
                    });

                    // Set the rate field value in the current line
                    currentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        value: calculatedRate
                    });

                    // Commit the changes for the current line
                    currentRecord.commitLine({
                        sublistId: 'item'
                    });
                }
            }
        }

        return true; // Return true to allow the save
    }

    function fieldChanged(context) {
        if (context.fieldId === 'custcol_srp_ppkb') {
            const currentRecord = context.currentRecord;
            const line = context.line;
            log.debug('script');
            // Get the value of custcol24
            const PricePerKg = currentRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'custcol_srp_ppkb'
            });
            if (PricePerKg) {

                const itemId = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                });
                if (itemId) {
                    var itemRecord = search.lookupFields({
                        type: search.lookupFields({ type: "item", id: itemId, columns: ['recordtype'] })['recordtype'],
                        id: itemId,
                        columns: ['custitem_srp_ekg']
                    });
                    if (itemRecord.custitem_srp_ekg) {
                        const calculatedRate = PricePerKg * itemRecord.custitem_srp_ekg;

                        // Set the rate field value
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            value: calculatedRate,
                            ignoreFieldChange: false,
                            forceSyncSourcing: true
                        });

                    }
                }
                //   const itemtype = currentRecord.getCurrentSublistValue({
                //       sublistId: 'item',
                //       fieldId: 'itemtype'
                //   });
                //   log.debug('Itemtype', itemtype);

                //   let recordType;
                //   switch (itemtype) {
                //       case 'Assembly':
                //           recordType = record.Type.ASSEMBLY_ITEM;
                //           break;
                //       case 'Inventory':
                //           recordType = record.Type.INVENTORY_ITEM;
                //           break;
                //       case 'NonInvtPart':
                //           recordType = record.Type.NON_INVENTORY_ITEM;
                //           break;
                //       case 'Service':
                //           recordType = record.Type.SERVICE_ITEM;
                //           break;
                //       case 'OtherCharge':
                //           recordType = record.Type.OTHER_CHARGE_ITEM;
                //           break;
                //       case 'Kit':
                //           recordType = record.Type.KIT_ITEM;
                //           break;
                //       // Add more cases as needed for other item types
                //       default:
                //           log.error('Unsupported Item Type', itemtype);
                //           return;
                //   }

                //   if (!recordType) {
                //       log.debug('Invalid Item type', "INVALID ITEM")
                //       return true;
                //   }

                // Load the item record to get the custcol24 value
                //   const itemRecord = record.load({
                //       type: record.Type.ASSEMBLY_ITEM,
                //       id: itemId
                //   });

                //   const itemCustcol24 = itemRecord.getValue({
                //       fieldId: 'custitem92'
                //   });


            }
        }

        if (context.fieldId === 'rate') {
            const currentRecord = context.currentRecord;
            const line = context.line;

            // Get the value of custcol24
            const rate = currentRecord.getCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate'
            });
            if (rate) {

                const itemId = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'item'
                });
                if (itemId) {
                    var itemRecord = search.lookupFields({
                        type: search.lookupFields({ type: "item", id: itemId, columns: ['recordtype'] })['recordtype'],
                        id: itemId,
                        columns: ['custitem_srp_ekg']
                    });
                    if (itemRecord.custitem_srp_ekg) {
                        const calculatedRate = rate / itemRecord.custitem_srp_ekg;

                        // Set the rate field value
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_srp_ppkb',
                            value: calculatedRate,
                            ignoreFieldChange: true,
                            forceSyncSourcing: true
                        });

                    }
                }
                //   const itemtype = currentRecord.getCurrentSublistValue({
                //       sublistId: 'item',
                //       fieldId: 'itemtype'
                //   });
                //   log.debug('Itemtype', itemtype);

                //   let recordType;
                //   switch (itemtype) {
                //       case 'Assembly':
                //           recordType = record.Type.ASSEMBLY_ITEM;
                //           break;
                //       case 'Inventory':
                //           recordType = record.Type.INVENTORY_ITEM;
                //           break;
                //       case 'NonInvtPart':
                //           recordType = record.Type.NON_INVENTORY_ITEM;
                //           break;
                //       case 'Service':
                //           recordType = record.Type.SERVICE_ITEM;
                //           break;
                //       case 'OtherCharge':
                //           recordType = record.Type.OTHER_CHARGE_ITEM;
                //           break;
                //       case 'Kit':
                //           recordType = record.Type.KIT_ITEM;
                //           break;
                //       // Add more cases as needed for other item types
                //       default:
                //           log.error('Unsupported Item Type', itemtype);
                //           return;
                //   }

                //   if (!recordType) {
                //       log.debug('Invalid Item type', "INVALID ITEM")
                //       return true;
                //   }

                // Load the item record to get the custcol24 value
                //   const itemRecord = record.load({
                //       type: record.Type.ASSEMBLY_ITEM,
                //       id: itemId
                //   });

                //   const itemCustcol24 = itemRecord.getValue({
                //       fieldId: 'custitem92'
                //   });


            }
        }
    }

    return {
        fieldChanged: fieldChanged,
        saveRecord: saveRecord
    };
});
