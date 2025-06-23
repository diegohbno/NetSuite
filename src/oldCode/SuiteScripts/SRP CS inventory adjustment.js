/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 */
define(['N/record', 'N/log','N/search','N/runtime'], function(record, log,search,runtime) {

  function fieldChanged(context) {
      try {
          var currentRecord = context.currentRecord;
          var sublistName = context.sublistId;
          var fieldName = context.fieldId;
        var currentUser=runtime.getCurrentUser().id;
        log.debug('currentUser',currentUser);

         
            if (sublistName === 'inventory' && fieldName === 'unitcost' && (currentUser != 41854 && currentUser != 30575   && currentUser != 37574)) {
           

              var item = currentRecord.getCurrentSublistValue({
                  sublistId: 'inventory',
                  fieldId: 'item'
              });log.debug('item value',item);
              
              var unitcost = currentRecord.getCurrentSublistValue({
                  sublistId: 'inventory',
                  fieldId: 'unitcost'
              });log.debug('unitcost value',unitcost);

                 var itemRecord= search.lookupFields({
                              type: "item",
                              id: item,
                              columns: ['averagecost']
                          });
                          if(itemRecord.averagecost != unitcost){
                              alert('you cannot change the EST Unit Cost Values');
                              log.debug('average code form item',itemRecord.averagecost);

                              currentRecord.setCurrentSublistValue({
                                  sublistId: "inventory",
                                  fieldId: "unitcost",
                                  value: itemRecord.averagecost,
                                  ignoreFieldChange: true,
                                  forceSyncSourcing: true
                              });
                              
                          }

              // log.debug({
              //     title: 'Field Disabled',
              //     details: 'Field ' + sublistField + ' at line ' + ' has been disabled.'
              // });
          }
          
         
      } catch (e) {
          log.error({
              title: 'Error disabling field',
              details: e.message
          });
      }
  }
 
  return {
      fieldChanged: fieldChanged,
    
  };

});
