/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define([
    "N/ui/serverWidget",
    "N/file",
    "N/encode",
    "N/log",
    "N/search",
    "N/runtime",
    "N/email",
    "N/ui/message",
    "N/record",
    "N/redirect",
    "N/format",
  ], function (
    serverWidget,
    file,
    encode,
    log,
    search,
    runtime,
    email,
    message,
    record,
    redirect,
    format
  ) {
    function execute(context) {
      try {
          //var uploadedFile = context.parameters.custscript_file; 
    
          var uploadedFile = runtime.getCurrentScript().getParameter({
                  name: "custscript_file"
              });
             
          log.debug('uploadfile',uploadedFile);
          
  
          ///////////////////////////date for external Id//////////////////////
          var currentDate = new Date();
          var day = ("0" + currentDate.getDate()).slice(-2);
          var month = ("0" + (currentDate.getMonth() + 1)).slice(-2); // getMonth() returns 0-based month index
          var year = currentDate.getFullYear();
          var hours = ("0" + currentDate.getHours()).slice(-2);
          var minutes = ("0" + currentDate.getMinutes()).slice(-2);
          var externalid = "AZN" + month + day + year + hours + minutes;
          /////////////////////////////save UNproccess file////////////////////
          // uploadedFile.folder = "13813";
          // uploadedFile.name = currentDate + "UnprocessFile.csv";
          // var fileId = uploadedFile.save();
          var uploadedFile = file.load({
              id: parseInt(uploadedFile)
          });
          //    log.debug('File Saved', 'File ID: ' + fileId);
          //////////////////////////File first row////////////////////////////
          var fileData = [
            "External ID",
            "Amazon store",
            "Start date",
            "End date",
            "Parent ASIN",
            "ASIN",
            "FNSKU",
            "MSKU",
            "Item Internal ID",
            "ReturnPrice",
            "Average sales price",
            "Units sold",
            "Units returned",
            "Net units sold",
            "Sales",
            "Net sales",
            "Lot Number Name",
            "Lot Number Id" + "\n",
          ];
          var errorFileLogData = [
            "External ID",
            "Amazon store",
            "Start date",
            "End date",
            "Parent ASIN",
            "ASIN",
            "FNSKU",
            "MSKU",
            "Item Internal ID",
            "ReturnPrice",
            "Average sales price",
            "Units sold",
            "Units returned",
            "Net units sold",
            "Sales",
            "Net sales",
            "Error Log" + "\n",
          ];
          if (uploadedFile && uploadedFile.fileType === file.Type.CSV) {
            var fileContents = uploadedFile.getContents();
  
            // Convert file contents to UTF-8
            var encodedContents = encode.convert({
              string: fileContents,
              inputEncoding: encode.Encoding.UTF_8,
              outputEncoding: encode.Encoding.UTF_8,
            });
  
           // Split contents into rows and then into columns
  var rows = encodedContents.split("\n");
  // var data = rows.map(function (row) {
  //   return row.split(",");
  // });
  
  // Remove the header row from the original data
  rows.shift();
  
  // Initialize grouped file data with headers as an array of arrays
  var groupedfiledata = [
  ['amazonStore', 'enddate', 'startDate', 'parentAssian', 'asin', 'fnsku', 'Item', 'returnprice', 'averageSalesPriceGrouped', 'quantityGroup', 'returnQuantity', 'netunitsold', 'sales', 'netsales']
  ];
  
  
  
  
  var match = false;
  //groupedfiledata.shift();
  for (var j = 0; j < rows.length; j++) {
  
    var line = rows[j].trim();
  
    // Skip empty lines
    if (!line) {
        continue;
    }
    var RowsNumber = parseCSVLine(line);
  
  //var RowsNumber = data[j];
  
  var startDate = RowsNumber[0];
  startDate=startDate.replace(',', '');
  var Item = RowsNumber[4];
  var Quantity = parseFloat(RowsNumber[6]);
  var averageSalesPrice = parseFloat(RowsNumber[13]);
  
  //log.debug('row in file '+(j+1),'start Date '+startDate+' item  '+Item+' quantity '+Quantity+' aversalesprice '+averageSalesPrice);
  // Reset the match flag for each row
  match = false;
  
  // Iterate through grouped data and find matching items
  for (var i = 0; i < groupedfiledata.length; i++) {
    var rowsgroup = groupedfiledata[i];
    var itemgroupd = rowsgroup[6];  // Index for 'Item'
    var quantityGroup = parseFloat(rowsgroup[9]);  // Index for 'quantityGroup'
    var averageSalesPriceGrouped = parseFloat(rowsgroup[8]);  // Index for 'averageSalesPriceGrouped'
    var returnQuantity = parseFloat(rowsgroup[10]);
    var returnPrice=parseFloat(rowsgroup[7])  // Index for 'returnQuantity'
  //  log.debug('row in structure '+(i+1),'item group '+itemgroupd+' quantity Group '+quantityGroup+' aversalespriceGroup '+averageSalesPriceGrouped+' return quantity '+returnQuantity);
  
    if (itemgroupd === Item && Item) {
     // log.debug('Item match', itemgroupd + ' & ' + Item);
        
      // Update quantities and prices for matching item
      if (averageSalesPrice < 0) {
        returnQuantity += Quantity;
      
       averageSalesPrice=(averageSalesPrice*(-1));
        returnPrice += averageSalesPrice;
  
        
      } else {
        quantityGroup += Quantity;
       
            averageSalesPriceGrouped+=averageSalesPrice;
  
        
      }
      
    //  log.debug('before set in structure '+(i+1),'item group '+Item+' quantity Group '+quantityGroup+' aversalespriceGroup '+averageSalesPriceGrouped+' return quantity '+returnQuantity);
      // Update the grouped data
      groupedfiledata[i] = [
        'amazonStore', 'enddate', startDate, 'parentAssian', 'asin', 'fnsku', Item, returnPrice, 
        averageSalesPriceGrouped, quantityGroup, returnQuantity, 'netunitsold', 'sales', 'netsales'
      ];
  
      match = true;
      break;
    }
  }
  
  // If no match was found, add a new row for the item
  if (match== false && Item && Item.length<10) {
  //   log.debug('else part in struecture '+(i+1),'item group '+itemgroupd+' quantity Group '+(averageSalesPrice >= 0 ? Quantity : 0)+' aversalespriceGroup '+(averageSalesPrice < 0 ? (averageSalesPrice)*(-1) : averageSalesPrice == 0 ? 0 : averageSalesPrice)+' return quantity '+(averageSalesPrice < 0 ? Quantity : 0));
    groupedfiledata.push([
      'amazonStore', 'enddate', startDate, 'parentAssian', 'asin', 'fnsku', Item, (averageSalesPrice < 0 ? averageSalesPrice*(-1) : 0),
      (averageSalesPrice >= 0 ? averageSalesPrice : 0), (averageSalesPrice >= 0 ? Quantity : 0), (averageSalesPrice < 0 ? Quantity : 0), 'netunitsold', 'sales', 'netsales'
    ]);
  }
  }
  
  // Log the final grouped file data
  //log.debug('Grouped file data final', JSON.stringify(groupedfiledata));
                log.debug('grouped file',groupedfiledata);
  
        var dateString= dateCorrection(groupedfiledata[1][2]);
    log.debug('dateString',dateString);
  var data;
  data=groupedfiledata;
  var csvContent = groupedfiledata.map(function(row) {
    return row.join(',');
  }).join('\n');
  //log.debug('groupfile log',csvContent);

  var csvFile = file.create({
    name: 'groupfile.csv',
    fileType: file.Type.CSV,
    contents: csvContent,
  });
  // log.debug("csv file", csvFile);
  
  csvFile.folder = '15944';
  
              // Save the file to the file cabinet
              var fileId = csvFile.save();
  
            var lotNumberActual = 0;
            var errorLog = "";
            var lotQuantityHandle = 0;
            for (var j = 0; j < data.length; j++) {
              lotNumberActual = 0;
              errorLog = "";
              lotQuantityHandle = 0;
              var RowsNumber = data[j];
              //    log.debug("row number" + (j + 1), RowsNumber);
  
              var amazonStore = RowsNumber[0];
              var startDate = RowsNumber[1];
              var endDate = RowsNumber[2];
              var ParentASIN = RowsNumber[3];
              var ASIN = RowsNumber[4];
              var FNSKU = RowsNumber[5];
              var Item = RowsNumber[6];
              var returnPrice = RowsNumber[7];
              var averageSalesPrice = RowsNumber[8];
              var Quantity = RowsNumber[9];
              var UnitsReturn = RowsNumber[10];
              var netUnitSold = RowsNumber[11];
              var sales = RowsNumber[12];
              var netSales = RowsNumber[13];
              returnPrice=parseFloat(returnPrice)/parseFloat(UnitsReturn?UnitsReturn:1);
                averageSalesPrice=parseFloat(averageSalesPrice)/parseFloat(Quantity?Quantity:1); //////new changing
              // Log the extracted values
              // log.debug("customer", customer);
              // log.debug("Item", Item);
           //   log.debug("Quantity", Quantity);
              // log.debug("Rate", Rate);
  
              if (Item && Quantity > 0) {
                Item = [Item];
  
                var assemblyitemSearchObj = search.create({
                  type: "item",
                  filters: [
                    ["name", "is", Item],
                    "AND",
                    ["type", "anyof", "Assembly", "InvtPart"],
                    "AND",
                    ["inventorynumber.location", "anyof", "32"],
                    "AND",
                    ["inventorynumber.isonhand", "is", "T"],
                  ],
                  columns: [
                    search.createColumn({
                      name: "item",
                      join: "inventoryNumber",
                    }),
                    search.createColumn({
                      name: "quantityonhand",
                      join: "inventoryNumber",
                    }),
                    search.createColumn({
                      name: "inventorynumber",
                      join: "inventoryNumber",
                    }),
                    search.createColumn({
                      name: "internalid",
                      join: "inventoryNumber",
                    }),
                  ],
                });
                var searchResult = assemblyitemSearchObj.run().getRange({
                  start: 0,
                  end: 1000,
                });
              //  log.debug("save search length", searchResult.length);
  
                var quantitySum = 0;
                for (var sum = 0; sum < searchResult.length; sum++) {
                  var quantitylot = searchResult[sum].getValue({
                    name: "quantityonhand",
                    join: "inventoryNumber",
                  }); // log.debug('quantitylot Value', quantitylot);
  
                  quantitySum = parseFloat(quantitySum) + parseFloat(quantitylot);
                }
              //  log.debug("quantity sum", quantitySum);
                if (searchResult.length === 0) {
                  errorLog = "There is no lot that exists for this item.";
                } else if (quantitySum < Quantity) {
                  errorLog =
                    "Sum of all Lot Quantity (" +
                    quantitySum +
                    ") is Less Then " +
                    Quantity;
                  //  log.debug('error log',errorLog);
                } else {
                  for (var k = 0; k < searchResult.length; k++) {
                    var Lotquantity = searchResult[k].getValue({
                      name: "quantityonhand",
                      join: "inventoryNumber",
                    }); //log.debug('quantity Value', Lotquantity);
  
                    var lotNumber = searchResult[k].getValue({
                      name: "internalid",
                      join: "inventoryNumber",
                    }); // log.debug('lotNumber Value', lotNumber);
  
                    var lotNumberName = searchResult[k].getValue({
                      name: "inventorynumber",
                      join: "inventoryNumber",
                    }); //log.debug('lotNumberName Value', lotNumberName);
  
                    var itemInternalId = searchResult[k].getValue({
                      name: "item",
                      join: "inventoryNumber",
                    }); //log.debug('itemInternalId Value', itemInternalId);
  
                    if (parseFloat(Quantity) <= Lotquantity) {
                      //Quantity =1100  lotquantity=1
  
                      lotNumberActual = lotNumber;
                      k = searchResult.length;
                    } else if (Lotquantity != 0) {
                      // lotquantity = 1000
                      lotQuantityHandle = Lotquantity; //lotQuantityHandle = 1000
                      lotNumberActual = lotNumber;
                      fileData += [
                        externalid,
                        amazonStore,
                        startDate,
                        endDate,
                        ParentASIN,
                        ASIN,
                        FNSKU,
                        Item,
                        itemInternalId,
                        returnPrice,
                        averageSalesPrice,
                        lotQuantityHandle,
                        UnitsReturn,
                        netUnitSold,
                        sales,
                        netSales,
                        lotNumberName,
                        lotNumber + "\n",
                      ];
                      Quantity = Quantity - lotQuantityHandle; //Quantity = 100
                    }
                  }
                }
  
                //    log.debug('lotNumber actual', lotNumberActual);
                if (lotNumberActual != 0) {
                  fileData += [
                    externalid,
                    amazonStore,
                    startDate,
                    endDate,
                    ParentASIN,
                    ASIN,
                    FNSKU,
                    Item,
                    itemInternalId,
                    returnPrice,
                    averageSalesPrice,
                    Quantity,
                    UnitsReturn,
                    netUnitSold,
                    sales,
                    netSales,
                    lotNumberName,
                    lotNumber + "\n",
                  ];
                }
                if (errorLog != "") {
                  errorFileLogData += [
                    externalid,
                    amazonStore,
                    startDate,
                    endDate,
                    ParentASIN,
                    ASIN,
                    FNSKU,
                    Item,
                    itemInternalId,
                    returnPrice,
                    averageSalesPrice,
                    Quantity,
                    UnitsReturn,
                    netUnitSold,
                    sales,
                    netSales,
                    errorLog + "\n",
                  ];
                }
              }
            }
  
            // var alertMessage = message.create({
            //   title: "Success",
            //   message: "Updated File Send to your mail Successfully.",
            //   type: message.Type.CONFIRMATION,
            // });
  
            if (fileData.length > 20) {
              var cashsalesData = fileData;
                log.debug('cash sales',cashsalesData)
              var rows = cashsalesData.split("\n");
              var cashsalesData = rows.map(function (row) {
                return row.split(",");
              });
              cashsalesData.shift();
            }
  
            var date = new Date();
            //   log.debug('date', date);
  
            //  log.debug('error file log data',errorFileLogData);
         //   log.debug("error file log data", errorFileLogData.length);
            var folderId = "15943";
            var emailbody = "Please Find Attachments";
            var emailSubject = "Updated File Amazon";
            var CSVfileName = "UpDatedFile.csv";
            var PageTitle = "File Updated Successfully";
  
            log.debug("error file log length", errorFileLogData.length);
            if (errorFileLogData.length > 20) {
              fileData = errorFileLogData;
              folderId = "15945";
              emailbody = "File have Errors Present in Attachment file";
              emailSubject = "Amazon Error File Log";
              CSVfileName = "ErrorFileLog.csv";
              PageTitle = "Error File Sent to your mail";
              var alertMessage = message.create({
                title: "Error",
                message:
                  "There are certain errors sent to you as an attachment of the email.",
                type: message.Type.ERROR,
              });
            }
          //  log.debug("before csv file");
  
          //  log.debug("field data", fileData);
            if (fileData.length > 20) {
              var csvFile = file.create({
                name: date + " " + CSVfileName,
                fileType: file.Type.CSV,
                contents: fileData,
              });
             // log.debug("csv file", csvFile);
              // Specify the folder ID where the file will be saved
              // Replace with your actual folder ID
              csvFile.folder = folderId;
  
              // Save the file to the file cabinet
              var fileId = csvFile.save();
              var currentUser = runtime.getCurrentUser();
          //    log.debug("current user", currentUser.id);
  
              var emailOptions = {
                author: currentUser.id, // Replace with the internal ID of the sender (typically -5 for current user)
                recipients: currentUser.id,
                subject: emailSubject,
                body: emailbody,
                attachments: [csvFile],
              };
  
              // Send email
              var emailId = email.send(emailOptions);
            }
            // log.debug('email send',emailId);
  
            // log.debug('CSV File Created', 'File ID: ' + fileId);
  
            // Log the data or process it as needed
            //   log.debug("CSV Data", JSON.stringify(data));
           // log.debug("data first", data[0]);
            // log.debug("data cashsalesData", cashsalesData[0]);
            
           
            
  
            var parsedDate = format.parse({
              value: dateString,
              type: format.Type.DATE,
            });
            ////////////////////////////////////change date/////////////////////////
           //parsedDate= new Date();
            var cashsalesInternalId = 0;
            if (folderId == "15943" && fileData.length > 20) {
              var cashSalesRecord = record.create({
                type: "cashsale",
                isDynamic: true,
              });
  
              cashSalesRecord.setValue({
                fieldId: "entity",
                value: 27734,
                ignoreFieldChange: false,
                forceSyncSourcing: true,
              });
  
              cashSalesRecord.setValue({
                fieldId: "location",
                value: 32,
              });
  
              cashSalesRecord.setValue({
                fieldId: "account",
                value: 779,
              });
  
              // Example date string from CSV
              // Ensure there are no extra spaces
  
              cashSalesRecord.setValue({
                fieldId: "trandate",
                value: parsedDate,
              });
  
            //  log.debug("date", cashsalesData[0].values);
              for (var row = 0; row < cashsalesData.length - 1; row++) {
                //   log.debug("file data row 1", cashsalesData[row]);
                var RowsNumber = cashsalesData[row];
  
                cashSalesRecord.selectNewLine({
                  sublistId: "item",
                });
  
                //  log.debug('item value',RowsNumber[8]);
                cashSalesRecord.setCurrentSublistValue({
                  sublistId: "item",
                  fieldId: "item",
                  value: RowsNumber[8],
                  //  line: i,
                  ignoreFieldChange: false,
                  forceSyncSourcing: true,
                });
  
                //  log.debug('quantity value',RowsNumber[13]);
                cashSalesRecord.setCurrentSublistValue({
                  sublistId: "item",
                  fieldId: "quantity",
                  value: RowsNumber[11],
                  //  line: i,
                  ignoreFieldChange: false,
                  forceSyncSourcing: true,
                });
                var amount =
                  parseFloat(RowsNumber[10]) * parseFloat(RowsNumber[11]);
                //   log.debug('amount',amount);
  
                cashSalesRecord.setCurrentSublistValue({
                  sublistId: "item",
                  fieldId: "amount",
                  value: amount,
                  //  line: i,
                  ignoreFieldChange: true,
                  forceSyncSourcing: true,
                });
                var inventoryDetailSubrecord =
                  cashSalesRecord.getCurrentSublistSubrecord({
                    sublistId: "item",
                    fieldId: "inventorydetail",
                    // line: 0
                  });
                //   log.debug("sublist subrecord", inventoryDetailSubrecord);
  
                inventoryDetailSubrecord.selectNewLine({
                  sublistId: "inventoryassignment",
                });
                // log.debug("lotnumbet", RowsNumber[17]);
  
                inventoryDetailSubrecord.setCurrentSublistValue({
                  sublistId: "inventoryassignment",
                  fieldId: "issueinventorynumber",
                  value: parseInt(RowsNumber[17]),
                });
  
                inventoryDetailSubrecord.setCurrentSublistValue({
                  sublistId: "inventoryassignment",
                  fieldId: "quantity",
                  value: RowsNumber[11],
                });
                //    log.debug("lot quantity", RowsNumber[11]);
  
                inventoryDetailSubrecord.commitLine({
                  sublistId: "inventoryassignment",
                });
  
                cashSalesRecord.commitLine({
                  sublistId: "item",
                });
              }
  
              cashsalesInternalId = cashSalesRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
              });
              log.debug("cash sales internaal id", cashsalesInternalId);
            }
  
            ///////////////////////create vendor return authorization/////////////////////////////
            var returnvalue = false;
            for (var row = 0; row < data.length - 1; row++) {
             // log.debug("file data row 1", data[row]);
              var RowsNumber = data[row];
              if (RowsNumber[10] > 0) {
                returnvalue = true;
                break;
              }
            }
  var returnauthorizationSave=0;
            if (returnvalue === true && errorFileLogData.length < 20) {
              var returnAuthorizationRecord = record.create({
                type: "returnauthorization",
                isDynamic: true,
              });
  
              returnAuthorizationRecord.setValue({
                fieldId: "customform",
                value: 211,
              });
  
              returnAuthorizationRecord.setValue({
                fieldId: "entity",
                value: 27734,
              });
  
              returnAuthorizationRecord.setValue({
                fieldId: "trandate",
                value: parsedDate,
              });
              var memo = "AIR " + dateString;
              returnAuthorizationRecord.setValue({
                fieldId: "memo",
                value: memo,
              });
  
              returnAuthorizationRecord.setValue({
                fieldId: "location",
                value: 32,
              });
              if (cashsalesInternalId) {
                returnAuthorizationRecord.setValue({
                  fieldId: "custbody_srp_cashsale",
                  value: cashsalesInternalId,
                });
              }
              for (var row = 0; row < data.length; row++) {
              //  log.debug("file data row 1", data[row]);
                var RowsNumber = data[row];
  
                if (RowsNumber[10] > 0) {
              //    log.debug("return item", RowsNumber[6]);
  
                  var itemSearchObj = search.create({
                    type: "item",
                    filters: [
                      ["name", "is", RowsNumber[6].trim()],
                      "AND",
                      ["isinactive", "is", "F"],
                    ],
                    columns: ["internalid", "itemid"],
                  });
                  var itemsearchresult = itemSearchObj.run().getRange({
                    start: 0,
                    end: 1000,
                  });
                  //log.debug('save search length', itemsearchresult.length);
                  if (itemsearchresult.length > 0) {
                    returnAuthorizationRecord.selectNewLine({
                      sublistId: "item",
                    });
  
                    var item = itemsearchresult[0].getValue({
                      name: "internalid",
                    }); // log.debug('item Value', item);
  
                    //  log.debug('item value',RowsNumber[8]);
                    returnAuthorizationRecord.setCurrentSublistValue({
                      sublistId: "item",
                      fieldId: "item",
                      value: item,
                      //  line: i,
                      ignoreFieldChange: false,
                      forceSyncSourcing: true,
                    });
  
                    //  log.debug('quantity value',RowsNumber[13]);
                    returnAuthorizationRecord.setCurrentSublistValue({
                      sublistId: "item",
                      fieldId: "quantity",
                      value: RowsNumber[10],
                      //  line: i,
                      ignoreFieldChange: false,
                      forceSyncSourcing: true,
                    });
                    var rate = parseFloat(RowsNumber[7])/parseFloat(RowsNumber[10]?RowsNumber[10]:1);
                    rate = rate < 0 ? 0 : rate;
                    var amount = parseFloat(RowsNumber[7]);
                    //   log.debug('amount',amount);
  
                    returnAuthorizationRecord.setCurrentSublistValue({
                      sublistId: "item",
                      fieldId: "rate",
                      value: rate,
                      //  line: i,
                      ignoreFieldChange: false,
                      forceSyncSourcing: true,
                    });
  
                    returnAuthorizationRecord.setCurrentSublistValue({
                      sublistId: "item",
                      fieldId: "amount",
                      value: amount,
                      //  line: i,
                      ignoreFieldChange: true,
                      forceSyncSourcing: true,
                    });
  
                    var inventoryDetailSubrecord =
                      returnAuthorizationRecord.getCurrentSublistSubrecord({
                        sublistId: "item",
                        fieldId: "inventorydetail",
                        // line: 0
                      });
                    // log.debug("sublist subrecord", inventoryDetailSubrecord);
  
                    inventoryDetailSubrecord.selectNewLine({
                      sublistId: "inventoryassignment",
                    });
                    // log.debug("lotnumbet", RowsNumber[17]);
                    //  log.debug('memo', memo);
  
                    inventoryDetailSubrecord.setCurrentSublistValue({
                      sublistId: "inventoryassignment",
                      fieldId: "receiptinventorynumber",
                      value: memo,
                    });
                    ///////////binnumber issueinventorynumber
                    inventoryDetailSubrecord.setCurrentSublistValue({
                      sublistId: "inventoryassignment",
                      fieldId: "quantity",
                      value: RowsNumber[10],
                    });
                    // log.debug("lot quantity", RowsNumber[10]);
  
                    inventoryDetailSubrecord.commitLine({
                      sublistId: "inventoryassignment",
                    });
                    // log.debug('inventory detail commited');
  
                    returnAuthorizationRecord.commitLine({
                      sublistId: "item",
                    });
                  }
                }
              }
  
              var returnauthorizationSave = returnAuthorizationRecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true,
              });
              log.debug(
                "return authorization created id",
                returnauthorizationSave
              );
              if (cashsalesInternalId != 0) {
                var cashSalesRecord = record.submitFields({
                  type: "cashsale",
                  id: cashsalesInternalId,
                  values: {
                    custbody_srp_returnaut: returnauthorizationSave,
                  },
                  options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true,
                  },
                });
              }
  
              if (returnauthorizationSave) {
                var refundRecord = record.transform({
                  fromType: "returnauthorization",
                  fromId: returnauthorizationSave,
                  toType: "cashrefund",
                  defaultValues: {
                    //  trandate: parsedDate
                  },
                }); //log.debug('item receipt id',itemreceiptRecord);
  
                refundRecord.setValue({
                  fieldId: "account",
                  value: 779,
                });
  
                refundRecord.setValue({
                  fieldId: "trandate",
                  value: parsedDate,
                });
  
                var refoundRecordCreateId = refundRecord.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                });
                log.debug("cash refound id", refoundRecordCreateId);
              }
  
              if (returnauthorizationSave) {
                var itemreceiptRecord = record.transform({
                  fromType: "returnauthorization",
                  fromId: returnauthorizationSave,
                  toType: "itemreceipt",
                  defaultValues: {
                    //  trandate: parsedDate
                  },
                });
                log.debug("item receipt id", itemreceiptRecord);
  
                itemreceiptRecord.setValue({
                  fieldId: "trandate",
                  value: parsedDate,
                });
  
                var returnAuthorizationRecord = record.load({
                  type: "returnauthorization",
                  id: returnauthorizationSave,
                });
  
                var lineCount = returnAuthorizationRecord.getLineCount({
                  sublistId: "item",
                });
  
                for (var i = 0; i < lineCount; i++) {
                  itemreceiptRecord.setSublistValue({
                    sublistId: "item",
                    fieldId: "itemreceive",
                    value: true,
                    line: i,
                    ignoreFieldChange: false,
                    forceSyncSourcing: true,
                  });
                }
  
                var itemReceiptID = itemreceiptRecord.save({
                  enableSourcing: true,
                  ignoreMandatoryFields: true,
                });
                log.debug("item receipt record id", itemReceiptID);
              }
            } ///////return value true
  
            if (cashsalesInternalId != 0) {
                var amazonRecord = record.submitFields({
                    type: "customrecord_amazon_file_record",
                    id: 1,
                    values: {
                        custrecord_transaction_field : cashsalesInternalId,
                        custrecord_error_feild_amazon:''
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
            //   redirect.toRecord({
            //     type: "cashsale",
            //     id: cashsalesInternalId,
            //   });
            } else if(cashsalesInternalId === 0 && returnauthorizationSave != 0){
                var amazonRecord = record.submitFields({
                    type: "customrecord_amazon_file_record",
                    id: 1,
                    values: {
                        custrecord_transaction_field : returnauthorizationSave,
                        custrecord_error_feild_amazon:''
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
  
            //   redirect.toRecord({
            //     type: "returnauthorization",
            //     id: returnauthorizationSave,
            //   });
             
  
              
            }else if(errorFileLogData.length > 20) {
  
  
                var amazonRecord = record.submitFields({
                    type: "customrecord_amazon_file_record",
                    id: 1,
                    values: {
                        custrecord_transaction_field : '',
                        custrecord_error_feild_amazon:'Error file sent to your Email'
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
            //    var confirmationForm = serverWidget.createForm({
            //     title: "Error file sent to your Email",
            //   });
  
            //   confirmationForm.addField({
            //     id: "custpage_confirmation",
            //     type: serverWidget.FieldType.INLINEHTML,
            //     label:
            //       "There is no Transaction in this file.",
            //     defaultValue:
            //       "There is no Transaction in this file.",
            //   });
  
            //   alertMessage.show();
            //   confirmationForm.addButton({
            //     id: "custpage_back",
            //     label: "Back",
            //     functionName: "window.history.go(-1)",
            //   });
            //   context.response.writePage(confirmationForm);
            }else  {
                var amazonRecord = record.submitFields({
                    type: "customrecord_amazon_file_record",
                    id: 1,
                    values: {
                        custrecord_transaction_field : '',
                        custrecord_error_feild_amazon:'There is no Transaction in this file.'
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields : true
                    }
                });
            //     var confirmationForm = serverWidget.createForm({
            //      title: "There is no Transaction in this file.",
            //    });
   
            //    confirmationForm.addField({
            //      id: "custpage_confirmation",
            //      type: serverWidget.FieldType.INLINEHTML,
            //      label:
            //        "There is no Transaction in this file.",
            //      defaultValue:
            //        "There is no Transaction in this file.",
            //    });
   
            //    alertMessage.show();
            //    confirmationForm.addButton({
            //      id: "custpage_back",
            //      label: "Back",
            //      functionName: "window.history.go(-1)",
            //    });
            //    context.response.writePage(confirmationForm);
             }
  
             
          } else {
            throw new Error("Please upload a CSV file.");
          }
        } catch (e) {
          log.error("Error", e.toString());
  
        }
    }
    function parseCSVLine(line) {
      var regex = /("([^"]*)")|([^,]+)/g;
      var match;
      var result = [];
      
      // Initialize a flag to track if we're in a quoted string
      var inQuotes = false;
      var currentField = '';
  
      for (var i = 0; i < line.length; i++) {
          var char = line[i];
  
          // Handle quotes to toggle inQuotes flag
          if (char === '"') {
              inQuotes = !inQuotes; // Toggle state on encountering a quote
          } else if (char === ',' && !inQuotes) {
              // On a comma outside of quotes, push the current field to the result
              result.push(currentField.trim() === '' ? null : currentField.trim());
              currentField = ''; // Reset currentField for the next field
          } else {
              currentField += char; // Accumulate characters for the current field
          }
      }
  
      // Push the last field after exiting the loop
      result.push(currentField.trim() === '' ? null : currentField.trim());
  
      return result;
    }
    function dateCorrection(dateString){
               /////////////date section///////////
  // var dateString = groupedfiledata[0][0]; // Combine date and time
  // log.debug('Raw dateString', dateString); // Debug the raw string
  dateString = dateString.replace(/"/g, '');
  // Example dateString: "Sep 6 2024 12:01:58 AM"
  
  // Split the date string into parts
  var dateParts = dateString.split(' '); // ["Sep", "6", "2024", "12:01:58", "AM"]
  log.debug('Date Parts', dateParts);
  
  // Extract the month, day, and year
  var monthStr = dateParts[0]; // "Sep"
  var day = parseInt(dateParts[1]); // "6" -> 6
  var year = parseInt(dateParts[2]); // "2024" -> 2024
  
  // Map month string to number
  var months = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
  };
  
  var month = months[monthStr]; // Convert "Sep" -> 9
  
  
    // Format the date as M/D/YYYY
     dateString = month + "/" + day + "/" + year;
    return dateString;
    }
    return {
      execute: execute,
      parseCSVLine:parseCSVLine,
      dateCorrection:dateCorrection
    };
  });
  