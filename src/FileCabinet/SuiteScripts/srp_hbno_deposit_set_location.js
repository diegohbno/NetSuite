/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/ui/message', 'N/log','N/search'], (message, log,search) => {
  

   

    const pageInit = (context) => {
        const { currentRecord} = context;

        try {
       let salesOrderId = currentRecord.getValue({
       fieldId: 'salesorder'
       });log.debug('salesOrderId value',salesOrderId);
       if(salesOrderId){

       
          let salesOrderRecord= search.lookupFields({
                       type: "salesorder",
                       id: salesOrderId,
                       columns: ['location','department']
                   });
                   let department=salesOrderRecord.department;
                   let location=salesOrderRecord.location;
                   if(location){
                        currentRecord.setValue({
                                   fieldId: 'location',
                                   value: location[0].value
                               });
                   }
                   if(department){
                    currentRecord.setValue({
                        fieldId: 'department',
                        value: department[0].value
                    });
                   }

                }
                } catch (error) {
                    log.error('Error on Field Change', error.message);
                }
    };

    return {
        pageInit,
    };
});
