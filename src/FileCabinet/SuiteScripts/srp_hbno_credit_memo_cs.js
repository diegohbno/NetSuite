/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/log'], (message, log) => {
    const pageInit = (context) => {
        const { currentRecord} = context;

        try {
            
             let approvalSataus = currentRecord.getValue({
             fieldId: 'custbody_srpcm'
             });log.debug('approvalSataus value',approvalSataus);

              let department = currentRecord.getValue({
              fieldId: 'department'
              });log.debug('department value',department);

              if(approvalSataus != 2 && (department == 13 || department == 15)){

                let linecount = currentRecord.getLineCount({
                    sublistId: 'apply'
                });log.debug('lineCount',linecount);

                for(let i = 0; i < linecount; i++){
                    log.debug('inside the loop');

                    let index=currentRecord.selectLine({
                        sublistId: 'apply',
                        line: i
                    });log.debug('index',index);
                    currentRecord.setCurrentSublistValue({
                        sublistId: "apply",
                        fieldId: "apply",
                        value: false,
                        line: i,
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                    });
                    log.debug('line values set');

                    currentRecord.commitLine({
                        sublistId: 'apply'
                    });
                }
              }
      


                } catch (error) {
                    log.error('Error on Field Change', error.message);
                }
    };
  
    const fieldChanged = (context) => {
        const { currentRecord, fieldId } = context;

        try {
            if(fieldId === 'apply'){
                let approvalSataus = currentRecord.getValue({
                    fieldId: 'custbody_srpcm'
                    });log.debug('approvalSataus value',approvalSataus);
       
                     let department = currentRecord.getValue({
                     fieldId: 'department'
                     });log.debug('department value',department);

                     let apply = currentRecord.getCurrentSublistValue({
                         sublistId: 'apply',
                         fieldId: 'apply'
                     });log.debug('apply value',apply);
       
                     if((approvalSataus != 2 && (department == 13 || department == 15)) && apply == true){
                        alert('Can not apply until status is approved');
                           currentRecord.setCurrentSublistValue({
                               sublistId: "apply",
                               fieldId: "apply",
                               value: false,
                               ignoreFieldChange: true,
                               forceSyncSourcing: true
                           });
                       
                     }
            }
      


                } catch (error) {
                    log.error('Error on Field Change', error.message);
                }
    };

    function saveRecord(context) {
       const {currentRecord}=context;
       let approvalSataus = currentRecord.getValue({
        fieldId: 'custbody_srpcm'
        });log.debug('approvalSataus value',approvalSataus);
       
         let department = currentRecord.getValue({
         fieldId: 'department'
         });log.debug('department value',department);
         let checkvalue=true;
         log.debug('check value',checkvalue);
         if(approvalSataus != 2 && (department == 13 || department == 15)){

           let linecount = currentRecord.getLineCount({
               sublistId: 'apply'
           });log.debug('lineCount',linecount);
           
           for(let i = 0; i < linecount; i++){
               log.debug('inside the loop');

               let index=currentRecord.selectLine({
                   sublistId: 'apply',
                   line: i
               });log.debug('index',index);

               
              let applyValue = currentRecord.getCurrentSublistValue({
                  sublistId: 'apply',
                  fieldId: 'apply'
              });log.debug('applyValue value',applyValue);
              if(applyValue === true){
                checkvalue =false;
                log.debug('check value inside if',checkvalue);
                break;
              }

             

               
           }
         }
         log.debug('check value before condition',checkvalue);
         if(checkvalue === false){
            alert('Can not apply until status is approved');
            return false;
         }else{
            return true; 
         }

        
    }

    return {
        pageInit,
        fieldChanged,
        saveRecord
    };
});
