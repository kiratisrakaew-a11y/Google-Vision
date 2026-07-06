function processInvoiceWithDocumentAi_(blob) {
  assertConfigured_('PROJECT_ID');
  assertConfigured_('LOCATION');
  assertConfigured_('PROCESSOR_ID');

  var endpoint = 'https://' + CONFIG.LOCATION + '-documentai.googleapis.com/v1/projects/' +
    encodeURIComponent(CONFIG.PROJECT_ID) + '/locations/' +
    encodeURIComponent(CONFIG.LOCATION) + '/processors/' +
    encodeURIComponent(CONFIG.PROCESSOR_ID) + ':process';

  var payload = {
    rawDocument: {
      content: Utilities.base64Encode(blob.getBytes()),
      mimeType: blob.getContentType()
    }
  };

  if (CONFIG.OCR_LANGUAGE_HINTS && CONFIG.OCR_LANGUAGE_HINTS.length) {
    payload.processOptions = {
      ocrConfig: {
        hints: {
          languageHints: CONFIG.OCR_LANGUAGE_HINTS
        }
      }
    };
  }

  var response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Document AI API error ' + status + ': ' + body);
  }

  return JSON.parse(body);
}
