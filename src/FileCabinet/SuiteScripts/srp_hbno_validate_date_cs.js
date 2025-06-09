/**
 *@NApiVersion 2.1
 *@NScriptType ClientScript
 */
 define(['N/currentRecord', 'N/record', 'N/search', 'N/format', 'N/log','N/url'], function (c, record, search, format, log, url) {

   
    function fieldChanged(context) {
     const {currentRecord,fieldId}=context;

             if(fieldId == 'custentity_srp_valid_license'){
                log.debug('field change');
                  var validate = currentRecord.getValue({
                  fieldId: 'custentity_srp_valid_license'
                  });log.debug('validate value',validate);
 
                   var certificate = currentRecord.getValue({
                   fieldId: 'custentity_srp_certificate'
                   });log.debug('certificate value',certificate);

                   var resalenumber = currentRecord.getValue({
                    fieldId: 'resalenumber'
                    });log.debug('resalenumber value',resalenumber);
 
                  if(validate ){
                    if(!certificate && ! resalenumber){
                        alert('To Validate License, Resale License must not be empty');
                        currentRecord.setValue({
                           fieldId: 'custentity_srp_valid_license',
                           value: false,
                           ignoreFieldChange: true,
                           forceSyncSourcing: true
                           
                       });
                    }else{
                        
 
                        var accountingperiodSearchObj = search.create({
                            type: "accountingperiod",
                            filters:
                            [
                               ["enddate","on","thisfiscalquarter"]
                            ],
                            columns:
                            [
                               "enddate"
                            ]
                         });var searchResult = accountingperiodSearchObj.run().getRange({
                             start: 0,
                             end: 1000
                         });
                         log.debug('save search length', searchResult.length);
                         if(searchResult.length>0){
                            var date = searchResult[0].getValue({
                                name: "enddate"
                            }); log.debug('date Value', date);
                         }
         
                     // Format the date to match NetSuite's date field format
                     var formattedLastDate = format.format({
                         value: date,
                         type: format.Type.DATE
                     });
                     log.debug('formated date',formattedLastDate);
 
                     var formattedLastDate = format.parse({
                         value: formattedLastDate,
                         type: format.Type.DATE
                     });
 
                      currentRecord.setValue({
                                 fieldId: 'custentity_srp_certificate_expdate',
                                 value: formattedLastDate,
                                 ignoreFieldChange: true,
                    forceSyncSourcing: true
                             });
                             
                             
                    
                    }
                     
                     
                  }
                 
             }

             if(fieldId == 'custentity_srp_certificate_expdate'){
                currentRecord.setValue({
                    fieldId: 'custentity_srp_valid_license',
                    value: false,
                    ignoreFieldChange: true,
                    forceSyncSourcing: true
                });

           }

           if(fieldId == 'custentity_srp_certificate'){


                 var certificate = currentRecord.getValue({
                 fieldId: 'custentity_srp_certificate'
                 });log.debug('certificate value',certificate);
                 if(!certificate){
                    currentRecord.setValue({
                        fieldId: 'custentity_srp_valid_license',
                        value: false,
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                    });
                    currentRecord.setValue({
                        fieldId: 'custentity_srp_certificate_expdate',
                        value: "",
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                    });
                 }

           

       }
    }
    function saveRecord(context) {
     const {currentRecord,fieldId}=context;
            log.debug('save record');
                  var validate = currentRecord.getValue({
                  fieldId: 'custentity_srp_valid_license'
                  });log.debug('validate value',validate);
 
                  var certificate = currentRecord.getValue({
                     fieldId: 'custentity_srp_certificate'
                     });log.debug('certificate value',certificate);
                     var resalenumber = currentRecord.getValue({
                        fieldId: 'resalenumber'
                        });log.debug('resalenumber value',resalenumber);
                  if(validate && (!certificate || !resalenumber)){
                    

                //     alert('Validate is checked but Resale License is empty');
                //     currentRecord.setValue({
                //        fieldId: 'custentity_srp_valid_license',
                //        value: false,
                //        ignoreFieldChange: true,
                //        forceSyncSourcing: true
                       
                //    });
                //    return false;
                    
                    
                       
                    
                     
                //   }else{
        //             if(validate && certificate){
        //               var accountingperiodSearchObj = search.create({
        //                     type: "accountingperiod",
        //                     filters:
        //                     [
        //                        ["enddate","on","thisfiscalquarter"]
        //                     ],
        //                     columns:
        //                     [
        //                        "enddate"
        //                     ]
        //                  });var searchResult = accountingperiodSearchObj.run().getRange({
        //                      start: 0,
        //                      end: 1000
        //                  });
        //                  log.debug('save search length', searchResult.length);
        //                  if(searchResult.length>0){
        //                     var date = searchResult[0].getValue({
        //                         name: "enddate"
        //                     }); log.debug('date Value', date);
        //                  }
         
                   
        //              var formattedLastDate = format.format({
        //                  value: date,
        //                  type: format.Type.DATE
        //              });
        //              log.debug('formated date',formattedLastDate);
 
        //              var formattedLastDate = format.parse({
        //                  value: formattedLastDate,
        //                  type: format.Type.DATE
        //              });
 
        //              currentRecord.setValue({
        //                 fieldId: 'custentity_srp_certificate_expdate',
        //                 value: formattedLastDate,
        //                 ignoreFieldChange: true,
        //    forceSyncSourcing: true
        //             });
        //             }
                   
                            if(!certificate && !resalenumber){
                                currentRecord.setValue({
                                    fieldId: 'custentity_srp_certificate_expdate',
                                    value: '',
                        ignoreFieldChange: true,
                        forceSyncSourcing: true
                                });
                            }

                            

                  }
                  currentRecord.setValue({
                    fieldId: 'custentity_srp_valid_license',
                    value: false
                });
                return true;
                  
             
    }
   
     return {
      
        fieldChanged:fieldChanged,
        saveRecord:saveRecord,
  
     }
  });