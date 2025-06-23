/**
 *@NApiVersion 2.1
 *@NScriptType WorkflowActionScript
 */
 define(['N/search','N/record', "N/email", "N/runtime","N/file"], function (search,record,email,runtime,file) {

    function onAction(context) {
        try {
           

                
                let currentRecord=context.newRecord;
                const id=currentRecord.id;
                let attachmentsArray=[];
                let department = currentRecord.getValue({
                fieldId: 'department'
                });log.debug('department value',department);

          let status = currentRecord.getValue({
                fieldId: 'status'
                });log.debug('status value',status);
                if(department == 4 && status != 'Cancelled'){
                    
                    let lineCount = currentRecord.getLineCount({
                        sublistId: 'item'
                    });
                    for(let i=0; i<lineCount; i++){

                        let item = currentRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line:i
                        });log.debug('item value',item);
                           let itemrecord= search.lookupFields({
                                        type: search.lookupFields({type: 'item', id: item, columns: 'recordtype'})['recordtype'],
                                        id: item,
                                        columns: ['custitem_srpemailverification']
                                    });log.debug('email verification',itemrecord.custitem_srpemailverification);
                                    if(itemrecord.custitem_srpemailverification && itemrecord.custitem_srpemailverification === true){

                                        let docAttach = currentRecord.getSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_srpattachment',
                                            line:i
                                        });log.debug('docAttach value',docAttach);
                
                                        attachmentsArray.push(docAttach);
                                        
                                    }

                    }
                
                     
                       if(attachmentsArray.length>0){
                           let customerId = currentRecord.getValue({
                               fieldId: 'entity'
                           }); log.debug('customerId value', customerId);
           
                           let customerRecord = search.lookupFields({
                               type: "customer",
                               id: customerId,
                               columns: ['email']
                           });
           
                           if (customerRecord.email) {
           
           
                               let customerEmail = customerRecord.email;
                              log.debug('customer email',customerEmail);
                               let authorId = runtime.getCurrentUser().id;
                              log.debug('current user',authorId);
                               let subject = currentRecord.getValue({
                                fieldId: 'tranid'
                                });log.debug('subject value',subject);;
                             //  let body = 'Dear Customer,\n\nPlease find attached the documents related to your sales order.\n\nThank you for your business.\n\nBest regards,';
                               let attachments = [];
                               log.debug('array length',attachmentsArray.length);
                                let body = currentRecord.getValue({
                                fieldId: 'custbody_srp_email_body'
                                });log.debug('body value',body);
                               
                               for (const element of attachmentsArray) {
           
                                   log.debug('array value',element);
           
                                   let fileObj = file.load({
                                       id: element
                                   });
                                   log.debug('file obj',fileObj);
                                   
                                   attachments.push(fileObj);
                               }
                               if(attachments.length>0){
                                 let authorValue = currentRecord.getValue({
                                 fieldId: 'salesrep'
                                 });log.debug('authorValue value',authorValue);
                                 email.send({
                                       author: authorValue,
                                       recipients: customerEmail,
                                       subject: subject,
                                       body: body,
                                       attachments: attachments,
                                       relatedRecords: {
                                           transactionId: id
                                       }
                                   });
               
                                   log.debug('email Sent');
                               }
                           }
                       }
                   }
                


        } catch (e) {
            log.debug("exeption", e)
        }
    }

    return {
        onAction: onAction
    }
});



