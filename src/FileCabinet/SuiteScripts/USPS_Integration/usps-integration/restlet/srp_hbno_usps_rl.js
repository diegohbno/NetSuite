/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define(['N/record', 'N/file'], function(record, file) {

  const get = (requestParams) => {
    
    const createdFromId = requestParams.createdFromId;
   
    log.debug({ title: 'createdFromId', details: createdFromId });

    const rec = record.load({
        type: record.Type.SALES_ORDER, // or use a switch if dynamic
        id: createdFromId
    });

    log.debug({ title: 'rec', details: rec.id });

    const location = rec.getValue({ fieldId: 'location' });

    log.debug({ title: 'location', details: location });

    return location;
  }

  const post = (context) => {
    try {
      const decodedPdf = file.decode({
        base64: context.base64
      });

      const pdfFile = file.create({
        name: context.filename || 'usps_label.pdf',
        fileType: file.Type.PDF,
        contents: decodedPdf,
        folder: context.folderId // must be a valid folder ID
      });

      const fileId = pdfFile.save();
      const fileObj = file.load({ id: fileId });

      return {
        success: true,
        fileId: fileId,
        url: fileObj.url
      };
    } catch (e) {
      return {
        success: false,
        error: e.message
      };
    }
  }

  return {
    get,
    post
  }
});