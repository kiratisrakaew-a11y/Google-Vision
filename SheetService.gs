function appendInvoiceToSheet_(record) {
  var sheet = getOrCreateSheet_(CONFIG.SHEET_NAME, INVOICE_HEADERS);
  var invoice = record.invoice || {};
  var validation = record.validation || {};

  sheet.appendRow([
    new Date(),
    record.fileName || '',
    record.fileUrl || '',
    getFieldValue_(invoice, 'supplier_name'),
    getFieldValue_(invoice, 'supplier_tax_id'),
    getFieldValue_(invoice, 'invoice_no'),
    getFieldValue_(invoice, 'invoice_date'),
    getFieldValue_(invoice, 'due_date'),
    getFieldValue_(invoice, 'subtotal'),
    getFieldValue_(invoice, 'vat'),
    getFieldValue_(invoice, 'total'),
    getFieldValue_(invoice, 'currency') || 'THB',
    validation.overallConfidence || 0,
    validation.lowestFieldConfidence || 0,
    validation.reviewStatus || '',
    (validation.missingFields || []).join(', '),
    (validation.lowConfidenceFields || []).join(', '),
    record.rawText || '',
    truncateForCell_(JSON.stringify(record.documentJson || {})),
    record.errorMessage || '',
    '',
    '',
    validation.reviewStatus === 'OK' ? 'APPROVED' : 'PENDING',
    ''
  ]);
}

function safeAppendErrorInvoiceRow_(fileName, errorMessage) {
  if (!isConfigured_('SHEET_ID')) {
    return;
  }

  appendErrorInvoiceRow_(fileName, errorMessage);
}

function appendErrorInvoiceRow_(fileName, errorMessage) {
  var sheet = getOrCreateSheet_(CONFIG.SHEET_NAME, INVOICE_HEADERS);

  sheet.appendRow([
    new Date(),
    fileName || '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'THB',
    0,
    0,
    'ERROR',
    '',
    '',
    '',
    '',
    errorMessage || '',
    '',
    '',
    'PENDING',
    ''
  ]);
}

function findDuplicateInvoice_(supplierTaxId, invoiceNo) {
  if (!supplierTaxId || !invoiceNo) {
    return { isDuplicate: false, rowNumber: null };
  }

  var sheet = getOrCreateSheet_(CONFIG.SHEET_NAME, INVOICE_HEADERS);
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { isDuplicate: false, rowNumber: null };
  }

  var values = sheet.getRange(2, 5, lastRow - 1, 2).getValues();
  for (var index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(supplierTaxId) && String(values[index][1]) === String(invoiceNo)) {
      return { isDuplicate: true, rowNumber: index + 2 };
    }
  }

  return { isDuplicate: false, rowNumber: null };
}

function writeLog_(level, fileName, step, message, errorDetail) {
  if (!isConfigured_('SHEET_ID')) {
    return;
  }

  var sheet = getOrCreateSheet_(CONFIG.LOG_SHEET_NAME, LOG_HEADERS);
  sheet.appendRow([
    new Date(),
    level || 'INFO',
    fileName || '',
    step || '',
    message || '',
    errorDetail || ''
  ]);
}

function getOrCreateSheet_(sheetName, headers) {
  assertConfigured_('SHEET_ID');

  var spreadsheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var needsHeader = headers.some(function (header, index) {
    return currentHeaders[index] !== header;
  });

  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function getFieldValue_(invoice, field) {
  return invoice[field] ? invoice[field].value : '';
}

function truncateForCell_(value) {
  var text = String(value || '');
  if (text.length <= CONFIG.MAX_DOCUMENT_JSON_CHARS) {
    return text;
  }

  return text.slice(0, CONFIG.MAX_DOCUMENT_JSON_CHARS) + '...TRUNCATED';
}
