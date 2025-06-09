/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define([
    "N/ui/serverWidget",
    "N/file",
    "N/encode",
    "N/log",
    "N/search",
    "N/runtime",
    "N/email",
    "N/ui/message",
    "N/record",
    "N/redirect",
    "N/format",
  ], function (
    serverWidget,
    file,
    encode,
    log,
    search,
    runtime,
    email,
    message,
    record,
    redirect,
    format
  ) {
    function execute(context) {
      try {
          //var uploadedFile = context.parameters.custscript_file; 
    var receive3plRecord = record.create({
        type: "custompurchase_srp_r3plo",
        isDynamic: true, 
      });
      receive3plRecord.setValue({
                        fieldId: 'entity',
                        value: 2396
                    });

                    receive3plRecord.setCurrentSublistValue({
               sublistId: "item",
               fieldId: "item",
               value: 99192,
               line: 0,
               ignoreFieldChange: false,
               forceSyncSourcing: true
           });
           receive3plRecord.setCurrentSublistValue({
            sublistId: "item",
            fieldId: "quantity",
            value: 1,
            line: 0,
            ignoreFieldChange: false,
            forceSyncSourcing: true
        });
        const currentInventoryDetailSubrecord =
        receive3plRecord.getCurrentSublistSubrecord({
            sublistId: "item",
            fieldId: "inventorydetail",
          });
        log.debug(
          "currentInventoryDetailSubrecord",
          currentInventoryDetailSubrecord
        );

        
            currentInventoryDetailSubrecord.selectNewLine({
              sublistId: "inventoryassignment",
            });
            currentInventoryDetailSubrecord.setCurrentSublistValue({
              sublistId: "inventoryassignment",
              fieldId: "receiptinventorynumber",
              value: '1011010',
            });
            // currentInventoryDetailSubrecord.setCurrentSublistValue({
            //   sublistId: "inventoryassignment",
            //   fieldId: "binnumber",
            //   value: binNumber,
            // });
            currentInventoryDetailSubrecord.setCurrentSublistValue({
              sublistId: "inventoryassignment",
              fieldId: "quantity",
              value: 1,
            });
            currentInventoryDetailSubrecord.commitLine({
              sublistId: "inventoryassignment",
            });
            receive3plRecord.commitLine({
                sublistId: 'item'
            });
            var  recrodid= receive3plRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });log.debug('recordid',recrodid);
          
        


        } catch (e) {
          log.error("Error", e.toString());
  
        }
    }
  
    return {
      execute: execute,
    };
  });
  