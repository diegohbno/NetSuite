/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/file', 'N/email', 'N/runtime'], (search, file, email, runtime) => {
    const execute = (context) => {
        try {
            let csvContent = 'Customer Name,Transaction ID,Message Date,Attachments\n';

            let messageSearchObj = search.create({
                type: "message",
                filters:
                [
                   ["messagetype","anyof","EMAIL"], 
                   "AND", 
                   ["customer.entityid","isnotempty",""], 
                   "AND", 
                   ["authoremail","doesnotcontain","HBNO.com"], 
                   "AND", 
                   ["transaction.type","anyof","CuTrSale103"], 
                   "AND", 
                   ["isincoming","is","T"], 
                   "AND", 
                   ["hasattachment","is","T"], 
                   "AND", 
                   ["attachments.filetype","anyof","PDF"], 
                   "AND", 
                   ["messagedate","onorafter","minutesago60"]
                ],
                columns:
                [
                   search.createColumn({
                      name: "altname",
                      join: "customer"
                   }),
                   search.createColumn({
                      name: "tranid",
                      join: "transaction"
                   }),
                   "messagedate",
                   "message",
                   "attachments"
                ]
             });
             let searchResultCount = messageSearchObj.runPaged().count;
             log.debug("messageSearchObj result count",searchResultCount);
             messageSearchObj.run().each(function(result){

                let customerName = result.getValue({ name: "altname", join: "customer" }) || '';log.debug('customer name',customerName);
                let transactionID = result.getValue({ name: "tranid", join: "transaction" }) || '';log.debug('transactionID ',transactionID);
                let messageDate = result.getValue("messagedate") || '';log.debug('messageDate',messageDate);
                // let message = result.getText("message") || '';log.debug('message',message);
                //  let attachmentURL = result.getText("attachments") || '';log.debug('attachmentURL',attachmentURL);
                //  log.debug('attachemnt length',attachmentURL.length);
                let attachmentIDs = result.getText({ name: "internalid", join: "attachments" }) || '';log.debug('attachmentURL',attachmentIDs);
                let accountId = runtime.accountId;
                let attachmentURLs = attachmentIDs.split(',').map(id => 
                    `https://${accountId}.app.netsuite.com/core/media/media.nl?id=${id.trim()}&c=${accountId}`
                ).join(' , ');
               // csvContent += `"${customerName}","${transactionID}","${messageDate}","${message}","${attachmentURL}"\n`;
               csvContent += `"${customerName}","${transactionID}","${messageDate}","${attachmentURLs}"\n`;
                return true;
             });
            log.debug('csvContent',csvContent);
            
            
            // Create a file and save in File Cabinet
            let fileObj = file.create({
                name: 'Message_Replies.csv',
                fileType: file.Type.CSV,
                contents: csvContent,
                folder: 204543 // SuiteScripts folder
            });
            
            let fileId = fileObj.save();
            
            // Send Email with Attachment
           // let recipientEmail = runtime.getCurrentScript().getParameter({ name: 'custscript_recipient_email' });
           
              let  recipientEmail = 'atif@srp.ai'; // Default email
                let author=37574;
                log.debug('author',author);
            email.send({
                author: author,
                recipients: recipientEmail,
                subject: 'Scheduled Report: Email Messages with Attachments',
                body: 'Please find the attached CSV report of messages with attachments.',
                attachments: [file.load({ id: fileId })]
            });
            
            log.debug('Success', 'CSV file generated and emailed successfully');
        } catch (error) {
            log.error('Error', error);
        }
    };
    
    return { execute };
});
