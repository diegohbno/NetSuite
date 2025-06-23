/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/log'], (message, log) => {
  
    const fieldChanged = (context) => {
        const { currentRecord, sublistId, fieldId, line } = context;

        try {
        if (sublistId === 'item' && fieldId === 'quantity') { 
              
                    const quantity = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                    });
                    const unit = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'units',
                    });
                    if(unit == 1 || unit ==''){
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_srp_pkc',
                            value: tofixDecimalPercentage(quantity*(2.20462)),
                            ignoreFieldChange: true,
                            forceSyncSourcing: true
                        });
                    }

                  
                
                }

                if (sublistId === 'item' && fieldId === 'custcol_srp_pkc') { 
              
                    const Poundquantity = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_pkc',
                    });
                    const unit = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'units',
                    });
                    if(unit == 1 || unit ==''){
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            value: tofixDecimalPercentage(Poundquantity*(0.453592)),
                        });
                    }
                   
                
                }
                if (sublistId === 'item' && fieldId === 'units') { 
              
                  
                    const unit = currentRecord.getCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'units',
                    });
                    if(unit != 1){
                        currentRecord.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_srp_pkc',
                            value: '',
                            ignoreFieldChange: true,
                            forceSyncSourcing: true
                        });
                    }
                   
                
                }

           
                



                } catch (error) {
                    log.error('Error on Field Change', error.message);
                }
    };
        // function lineInit(contex) {
        // const {currentRecord}=contex;

        // const quantity = currentRecord.getCurrentSublistValue({
        //     sublistId: 'item',
        //     fieldId: 'quantity',
        // });log.debug('quantity', quantity);

        // const unit = currentRecord.getCurrentSublistValue({
        //     sublistId: 'item',
        //     fieldId: 'units',
        // });log.debug('unit', unit);
        // if(unit == 1){
        //     currentRecord.setCurrentSublistValue({
        //         sublistId: 'item',
        //         fieldId: 'custcol_srp_pkc',
        //         value: tofixDecimalPercentage(quantity*(2.20462)),
        //         ignoreFieldChange: true,
        //         forceSyncSourcing: true
        //     });
        // }

        // }

        function postSourcing(context) {
            const {currentRecord,fieldId}=context;

            if(fieldId==='units'){
                const unit = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'units',
                });log.debug('post unit', unit);

                const quantity = currentRecord.getCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                });log.debug('post quantity', quantity);
                if(unit == 1 || unit == ''){
                    currentRecord.setCurrentSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_srp_pkc',
                        value: tofixDecimalPercentage(quantity*(2.20462)),
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                    });
                }
            }
            
        }

    
    
    function tofixDecimalPercentage(value) { //for ClientScript
        let fixedValue=value;
        if(fixedValue%1 !== 0){
         let index=fixedValue.toString();
        let deciimalNumber=index.split(".");
      if(deciimalNumber[1].length > 2){
        fixedValue=fixedValue.toFixed(5);
      }else{
        fixedValue=fixedValue.toFixed(deciimalNumber[1].length);
      }
        }
        return fixedValue;
    }

    return {
        fieldChanged,
        postSourcing,
       // lineInit,
        tofixDecimalPercentage
    };
});
