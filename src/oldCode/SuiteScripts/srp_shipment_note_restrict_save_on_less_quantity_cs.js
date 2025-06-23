/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/search','N/ui/dialog'], (search,dialog) => {
  
    const saveRecord = (context) => {
      const {currentRecord} = context;
      const recordId = currentRecord.id;
      log.debug('recordType',recordId);
               try {
                   
                  let ExceedQuantity=false;
               let location = currentRecord.getValue({
               fieldId: 'location'
               });log.debug('location value',location);
                let inventoryAdjustmentId = currentRecord.getValue({
                fieldId: 'custbody_srp_linked_inventory_adj'
                });log.debug('inventoryAdjustmentId value',inventoryAdjustmentId);
        
  
      const lineCount = currentRecord.getLineCount({ sublistId: 'item' });
  
      for (let i = 0; i < lineCount; i++) {
        currentRecord.selectLine({
            sublistId: 'item',
            line: i
        });
        const itemId = currentRecord.getCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item',
        });
  
        log.debug(`Line ${i}: Item ID = ${itemId}`);
  
        const inventoryDetailSubrecord = currentRecord.getCurrentSublistSubrecord({
          sublistId: 'item',
          fieldId: 'inventorydetail',
        });log.debug('inventoryDetailSubrecord',inventoryDetailSubrecord);
        ExceedQuantity= inventoryDetail(inventoryDetailSubrecord,itemId,location,inventoryAdjustmentId);
        log.debug('ExceedQuantity return',ExceedQuantity);
        if(ExceedQuantity === true){
          dialog.alert({
              title: 'Quantity Exceed',
              message: 'The entered quantity exceeds the available bin quantity'
            });
            break;
        }
      }
      return (ExceedQuantity !== true);
       // allow record to save
  }
  catch (e) {
      log.error('execption', e);
  }
    };
  
  
    // const inventoryDetail=(recordId,item,location,inventoryAdjustmentId) => {
    //   let value=false;
    //   var transactionSearchObj = search.create({
    //     type: "transaction",
    //     settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
    //     filters:
    //     [
    //        ["type","anyof","CuTrSale102"], 
    //        "AND", 
    //        ["internalid","anyof",recordId], 
    //        "AND", 
    //        ["mainline","is","F"], 
    //        "AND", 
    //        ["item","anyof",item], 
    //        "AND", 
    //        ["cogs","is","F"]
    //     ],
    //     columns:
    //     [
    //        search.createColumn({
    //           name: "inventorynumber",
    //           join: "inventoryDetail"
    //        }),
    //        search.createColumn({
    //           name: "binnumber",
    //           join: "inventoryDetail"
    //        }),
    //        search.createColumn({
    //           name: "quantity",
    //           join: "inventoryDetail"
    //        })
    //     ]
    //  });
    //  var searchResultCount = transactionSearchObj.runPaged().count;
    //  log.debug("transactionSearchObj result count",searchResultCount);
    //  transactionSearchObj.run().each(function(result){
    //     let lotnumber= result.getText({
    //        name: "inventorynumber",
    //           join: "inventoryDetail"
    //     });log.debug('lotnumber value',lotnumber);
  
    //     let binNumber = result.getValue({
    //        name: "binnumber",
    //           join: "inventoryDetail"
    //     });log.debug('binNumber value',binNumber);
    //     let quantity = result.getValue({
    //        name: "quantity",
    //           join: "inventoryDetail"
    //     });log.debug('quantity value',quantity);
  
    //     let lotquantityValue=lotQuantity(lotnumber,binNumber,location,item,inventoryAdjustmentId);
    //       log.debug('lotquantityValue',lotquantityValue);
  
    //       if(lotquantityValue<quantity || lotquantityValue === null){
    //           value=true;
    //           return false;
    //       }
  
    //       console.log(`  Inventory Line : Bin = ${binNumber}, Quantity = ${quantity}`);
  
    //     return true;
    //  });
    //   log.debug('value',value);
      
    //   return value;
    // }
    const inventoryDetail=(inventoryDetailSubrecord,item,location,inventoryAdjustmentId) => {
        let value=false;
        if (inventoryDetailSubrecord) {
          const inventoryLineCount = inventoryDetailSubrecord.getLineCount({
            sublistId: 'inventoryassignment'
          });
    
          for (let j = 0; j < inventoryLineCount; j++) {
            let line= inventoryDetailSubrecord.selectLine({
                sublistId: 'inventoryassignment',
                line: j
            });
           
            const binNumber = inventoryDetailSubrecord.getCurrentSublistValue({
              sublistId: 'inventoryassignment',
              fieldId: 'binnumber',
              line: j
            });log.debug('binNumber value',binNumber);
            
              let lotNumber = inventoryDetailSubrecord.getCurrentSublistValue({
                sublistId: 'inventoryassignment',
                fieldId: 'issueinventorynumber',
                line: j
              });log.debug('lotNumbertextisue value',lotNumber);
              lotNumber=lotIdTONameConversion(lotNumber);
              log.debug('lotNumber value',lotNumber);
    
            const quantity = inventoryDetailSubrecord.getCurrentSublistValue({
              sublistId: 'inventoryassignment',
              fieldId: 'quantity',
              line: j
            });log.debug('quantity',quantity);
            let lotquantityValue=lotQuantity(lotNumber,binNumber,location,item,inventoryAdjustmentId);
            log.debug('lotquantityValue',lotquantityValue);
    
            if(lotquantityValue<quantity || lotquantityValue === null){
                value=true;
                break;
            }
    
            console.log(`  Inventory Line ${j}: Bin = ${binNumber}, Quantity = ${quantity}`);
          }
        }
        
        return value;
      }
    const lotQuantity=(lotNumber,binNumber,location,item,inventoryAdjustmentId)=>{
  let value=null;
      const itemSearchObj = search.create({
          type: "item",
          filters:
          [
             ["internalid","anyof",item], 
             "AND", 
             ["inventorynumberbinonhand.binnumber","anyof",binNumber], 
             "AND", 
             ["inventorynumberbinonhand.inventorynumber","is",lotNumber], 
             "AND", 
             ["inventorynumberbinonhand.location","anyof",location]
          ],
          columns:
          [
             search.createColumn({
                name: "quantityavailable",
                join: "inventoryNumberBinOnHand"
             }),
             search.createColumn({
                name: "binnumber",
                join: "inventoryNumberBinOnHand"
             }),
             search.createColumn({
                name: "inventorynumber",
                join: "inventoryNumberBinOnHand"
             }),
             search.createColumn({
                name: "location",
                join: "inventoryNumberBinOnHand"
             }),
             search.createColumn({
                name: "quantityonhand",
                join: "inventoryNumberBinOnHand"
             })
          ]
       });
       const searchResultCount = itemSearchObj.runPaged().count;
       log.debug("itemSearchObj result count",searchResultCount);
       itemSearchObj.run().each(function(result){
           let available = result.getValue({
           name: "quantityavailable",
                join: "inventoryNumberBinOnHand"
           });log.debug('available value',available);
  
           let lotNumberId = result.getValue({
             name: "inventorynumber",
                join: "inventoryNumberBinOnHand"
              });log.debug('lotNumberId value',lotNumberId);
              let adjustmentQuantity=inventoryAdjustmentQuantity(inventoryAdjustmentId,item,lotNumberId,binNumber);
          log.debug('adjustmentQuantity',adjustmentQuantity);
           value=parseFloat(available)+parseFloat(adjustmentQuantity);
           log.debug('value',value);
          return true;
       });
       return value;
    }
    const inventoryAdjustmentQuantity=(inventoryAdjustmentId,item,lotNumber,binNumber) => {
     let value=0;
     if(inventoryAdjustmentId){
       log.debug('inventoryAdjustmentId',inventoryAdjustmentId);
      const inventoryadjustmentSearchObj = search.create({
          type: "inventoryadjustment",
          settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
          filters:
          [
             ["type","anyof","InvAdjst"], 
             "AND", 
             ["internalid","anyof",inventoryAdjustmentId], 
             "AND", 
             ["mainline","is","F"], 
             "AND", 
             ["item","anyof",item], 
             "AND", 
             ["inventorydetail.binnumber","anyof",binNumber], 
             "AND", 
             ["inventorydetail.inventorynumber","anyof",lotNumber]
          ],
          columns:
          [
             search.createColumn({
                name: "quantity",
                join: "inventoryDetail"
             })
          ]
       });
       const searchResultCount = inventoryadjustmentSearchObj.runPaged().count;
       log.debug("inventoryadjustmentSearchObj result count",searchResultCount);
       inventoryadjustmentSearchObj.run().each(function(result){
          let quantity = result.getValue({
           name: "quantity",
                join: "inventoryDetail"
          });log.debug('quantity value',quantity);
          value=parseFloat(quantity);
          
          return true;
       });
      }
       return value;
    }
    const lotIdTONameConversion=(lotId) => {
        let value=null;
        if(lotId){
          const lotnumberSearchObj = search.create({
              type: "inventorynumber",
              filters:
              [
                 ["internalid","anyof",lotId]
              ],
              columns:
              [
                 search.createColumn({
                    name: "inventorynumber"
                 })
              ]
           });
           const searchResultCount = lotnumberSearchObj.runPaged().count;
           log.debug("lotnumberSearchObj result count",searchResultCount);
           lotnumberSearchObj.run().each(function(result){
               value = result.getValue({
                   name: "inventorynumber"
                });
               return true;
           });
        }
        return value;
    }
  
    return {
      saveRecord
    };
  });
  