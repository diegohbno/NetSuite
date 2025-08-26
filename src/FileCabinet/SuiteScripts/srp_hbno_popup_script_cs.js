/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */

define(['N/url'],
  function (url) {

    const {
      SUITELET_SCRIPT
    } = Constants;
    
    const pageInit = (context) => {}
  
    const attach_label = (id, type) => {
      const suiteletUrl = url.resolveScript({
          scriptId: 'customscript_srp_hbno_coas_print_pdf_sl',
          deploymentId: 'customdeploy_srp_hbno_coas_print_pdf_sl',
          params: {
            recordId: id,      
            recordType: type  
          }
      });
      console.log('suitelet url', suiteletUrl);
      window.open(suiteletUrl,"socialPopupWindow","location=no,width=600,height=400,scrollbars=yes,top=150,left=350,resizable = no");
    }
  
    return {
      pageInit,
      attach_label
    };
  });


// button on lines to print label, popup, 