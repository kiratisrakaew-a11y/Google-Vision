function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Invoice Document AI Upload')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function uploadInvoice(payload) {
  var fileName = payload && payload.fileName ? payload.fileName : '';

  try {
    validateUploadPayload_(payload);
    writeLog_('INFO', fileName, 'UPLOAD', 'Upload payload validated', '');

    var blob = Utilities.newBlob(
      Utilities.base64Decode(payload.base64),
      payload.mimeType,
      payload.fileName
    );

    var uploadedFile = saveInvoiceFile_(blob);
    writeLog_('INFO', fileName, 'DRIVE', 'Invoice file saved to Drive', uploadedFile.getUrl());

    var documentAiResponse = processInvoiceWithDocumentAi_(blob);
    writeLog_('INFO', fileName, 'DOCUMENT_AI', 'Document AI processing completed', '');

    var document = documentAiResponse.document || {};
    var invoice = mapInvoiceFields_(document);
    var validation = validateInvoice_(invoice);
    var duplicate = findDuplicateInvoice_(invoice.supplier_tax_id.value, invoice.invoice_no.value);

    if (duplicate.isDuplicate && validation.reviewStatus === 'OK') {
      validation.reviewStatus = 'DUPLICATE';
    }

    appendInvoiceToSheet_({
      fileName: payload.fileName,
      fileUrl: uploadedFile.getUrl(),
      invoice: invoice,
      rawText: document.text || '',
      documentJson: documentAiResponse,
      validation: validation,
      errorMessage: ''
    });

    writeLog_('INFO', fileName, 'SHEET', 'Invoice row appended', validation.reviewStatus);

    return {
      success: true,
      fileUrl: uploadedFile.getUrl(),
      invoice: flattenInvoiceForClient_(invoice),
      validation: validation
    };
  } catch (err) {
    var message = err && err.message ? err.message : String(err);
    writeLog_('ERROR', fileName, 'PROCESS', 'Invoice processing failed', message);

    safeAppendErrorInvoiceRow_(fileName, message);

    return {
      success: false,
      message: message
    };
  }
}

function validateUploadPayload_(payload) {
  if (!payload || !payload.fileName || !payload.mimeType || !payload.base64) {
    throw new Error('Missing upload payload: fileName, mimeType, and base64 are required.');
  }

  if (SUPPORTED_MIME_TYPES.indexOf(payload.mimeType) === -1) {
    throw new Error('Unsupported file type: ' + payload.mimeType + '. Please upload PDF, JPG, or PNG.');
  }
}

function saveInvoiceFile_(blob) {
  assertConfigured_('DRIVE_FOLDER_ID');
  return DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID).createFile(blob);
}

function assertConfigured_(key) {
  if (!CONFIG[key] || String(CONFIG[key]).indexOf('PUT_YOUR_') === 0) {
    throw new Error('Missing configuration value: CONFIG.' + key);
  }
}

function flattenInvoiceForClient_(invoice) {
  var output = {};
  Object.keys(invoice).forEach(function (field) {
    output[field] = {
      value: invoice[field].value,
      confidence: invoice[field].confidence
    };
  });
  return output;
}
