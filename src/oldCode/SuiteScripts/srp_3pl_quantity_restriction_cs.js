/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(["N/record", "N/search", "N/currentRecord", "N/ui/dialog", "N/url"], (record,search,currentRecord,dialog,url) => {
    function pageInit(context) {
      var currentRecord=context.currentRecord;
      var recordType=currentRecord.type;
      
                   try {
                      var lineCount = currentRecord.getLineCount({
                          sublistId: 'item'
                      });
                                       for (var r = lineCount - 1; r >= 0; r--) {
                                        let line= currentRecord.selectLine({
                                            sublistId: 'item',
                                            line: r
                                        });
                                          var quantity3pl = currentRecord.getCurrentSublistValue({
                                              sublistId: 'item',
                                              fieldId: 'custcol_srp_3pl_quantity',
                                          });log.debug('quantity3pl value',quantity3pl);
                                          if(quantity3pl == 0){
                                              log.debug('inside the if');
                                              currentRecord.removeLine({
                                                  sublistId: 'item',
                                                  line: r,
                                                  ignoreRecalc: true // Set to true to bypass recalculation after removal, if needed.
                                                });
                                          }
                                          
                                        }
                       
          
                   }
                   catch (e) {
                       log.debug('execption', e);
                   }
            
      
    }
  
    function fieldChanged(context) {
     
              try {
                  
     
     const {currentRecord,fieldId}=context;
     const recordType=currentRecord.type;
     log.debug('field id',fieldId);
  
     if(fieldId === 'quantity'){
         let quantity = currentRecord.getCurrentSublistValue({
             sublistId: 'item',
             fieldId: 'quantity'
         });log.debug('quantity value',quantity);
  
         let quantityRecive = currentRecord.getCurrentSublistValue({
             sublistId: 'item',
             fieldId: 'custcol_srp_3pl_quantity'
         });log.debug('quantityRecive value',quantityRecive);
  
         if(quantity > quantityRecive){
             alert('Quantity must be less then or equal to Release order total quantity');
             currentRecord.setCurrentSublistValue({
                 sublistId: "item",
                 fieldId: "quantity",
                 value: '',
                 ignoreFieldChange: true,
                 forceSyncSourcing: true
             });
         }
     }
  }
  catch (e) {
     log.debug('execption', e);
  }
      
    }
    function saveRecord(context) {
      const {currentRecord}=context;
      var lineCount = currentRecord.getLineCount({
          sublistId: 'item'
      });
      for(let i=0; i<lineCount; i++){
  
        let lineNum= currentRecord.selectLine({
            sublistId: 'item',
            line: i
        });
        
        let quantity = currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
        });log.debug('quantity value',quantity);
  
        let quantityRecive = currentRecord.getCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_srp_3pl_quantity',
        });log.debug('quantityRecive value',quantityRecive);
  
        if(quantity > quantityRecive){
            alert('Quantity must be less then or equal to Release order total quantity');
            return false
        }else{
            return true
        }
      }
    }
   
     
     return {
      pageInit,
         fieldChanged,
         saveRecord
     };
   });
  