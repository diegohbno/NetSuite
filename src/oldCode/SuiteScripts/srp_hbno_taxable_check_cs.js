/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/search', 'N/log'], function (search, log,) {

    // function fieldChanged(context) {

    //     // Get current record object
    //     const {currentRecord,fieldId} = context


    //     try {
    //         if (fieldId === 'entity') {
    //             let expire=false;
    //             let certificate=0;
    //              const customer = currentRecord.getValue({
    //              fieldId: 'entity'
    //              });log.debug('customer value',customer);
    //              if(customer){

    //                 let address = currentRecord.getValue({
    //                     fieldId: 'shipaddress'
    //                     });log.debug('address value',address);

    //                     let haveValueInAddress =address.includes(' CA ');
    //                     log.debug('have value in address',haveValueInAddress);

    //                     let customerRecord= search.lookupFields({
    //                         type: "customer",
    //                         id: customer,
    //                         columns: ['custentity_srp_certificate','custentity_srp_certificate_expdate']
    //                     });

    //                     if(customerRecord.custentity_srp_certificate_expdate.length>0){
    //                          expire =  compareWithCurrentDate(customerRecord.custentity_srp_certificate_expdate);
    //                         log.debug('expire',expire);
    //                       }

    //                       if(customerRecord.custentity_srp_certificate.length>0){
    //                         certificate =  customerRecord.custentity_srp_certificate[0].value;
    //                        log.debug('certificate',certificate);
    //                      }

    //                     if(haveValueInAddress === false){
    //                         currentRecord.setValue({
    //                             fieldId: 'istaxable',
    //                             value: false
    //                         });
    //                     }
    //                    else if((haveValueInAddress && certificate !=0 && expire === true) || certificate === 0){
    //                         currentRecord.setValue({
    //                             fieldId: 'istaxable',
    //                             value: true
    //                         });
    //                     }
    //                     else if(haveValueInAddress || expire === false){
    //                         currentRecord.setValue({
    //                             fieldId: 'istaxable',
    //                             value: false
    //                         });
    //                     }


    //                         }




    //         }
    //     } catch (e) {
    //         log.debug('exeption', e);
    //     }


    // } 
    function saveRecord(context) {

        // Get current record object
        const { currentRecord, fieldId } = context


        try {

            let expire = false;
            let certificate = 0;
            const customer = currentRecord.getValue({
                fieldId: 'entity'
            }); log.debug('customer value', customer);
            if (customer) {

                let address = currentRecord.getValue({
                    fieldId: 'shipstate'
                }); log.debug('address value', address);
                //shipaddress
                let haveValueInAddress = false;
                if (address == 'CA' || address == 'California' ||
                    address == 'NY' || address == 'New York' ||
                    address == 'GA' || address == 'Georgia' ||
                    address == 'FL' || address == 'Florida' ||
                    address == 'UT' || address == 'Utah' ||
                    address == 'OH' || address == 'Ohio' ||
                    address == 'TX' || address == 'Texas' ||
                    address == 'NV' || address == 'Nevada' ||
                    address == 'NJ' || address == 'New Jersey' ||
                    address == 'PA' || address == 'Pennsylvania' ||
                    address == 'AZ' || address == 'Arizona' ||
                    address == 'OK' || address == 'Oklahoma'
                ) {
                    haveValueInAddress = true;
                }

                //   let haveValueInAddress =address.includes(' CA ') || address.includes(' NY ')|| address.includes(' GA ')|| address.includes(' FL ')|| address.includes(' UT ')|| address.includes(' OH ')|| address.includes(' TX ')|| address.includes(' NV ')|| address.includes(' NJ ')|| address.includes(' PA ')|| address.includes(' AZ ')|| address.includes(' OK ');
                //   log.debug('have value in address',haveValueInAddress);

                let customerRecord = search.lookupFields({
                    type: "customer",
                    id: customer,
                    columns: ['custentity_srp_certificate', 'custentity_srp_certificate_expdate']
                });

                if (customerRecord.custentity_srp_certificate_expdate.length > 0) {
                    expire = compareWithCurrentDate(customerRecord.custentity_srp_certificate_expdate);
                    log.debug('expire', expire);
                }

                if (customerRecord.custentity_srp_certificate.length > 0) {
                    certificate = customerRecord.custentity_srp_certificate[0].value;
                    log.debug('certificate', certificate);
                }

                if (haveValueInAddress === false) {
                    currentRecord.setValue({
                        fieldId: 'istaxable',
                        value: false
                    });
                }
                else if ((haveValueInAddress && certificate != 0 && expire === true) || certificate === 0) {
                    currentRecord.setValue({
                        fieldId: 'istaxable',
                        value: true
                    });
                }
                else if (haveValueInAddress || expire === false) {
                    currentRecord.setValue({
                        fieldId: 'istaxable',
                        value: false
                    });
                }


            }
            return true;




        } catch (e) {
            log.debug('exeption', e);
        }


    }

    function compareWithCurrentDate(inputDate) {
        try {
            // Convert inputDate string to JavaScript Date object
            var inputDateObj = new Date(inputDate);

            // Get the current date
            var currentDateObj = new Date();

            // Zero out the time for the current date for comparison (if you want to compare dates only, not time)
            currentDateObj.setHours(0, 0, 0, 0);

            // Compare the input date with the current date
            if (inputDateObj >= currentDateObj) {
                return false; // inputDate is in the future
            } else {
                return true; // inputDate is today or in the past
            }
        } catch (e) {
            log.error('Error comparing dates', e);
            return true;
        }
    }

    return {
        //   fieldChanged: fieldChanged,
        saveRecord: saveRecord,
        compareWithCurrentDate: compareWithCurrentDate

    };

});









