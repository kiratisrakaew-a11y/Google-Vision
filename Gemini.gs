/**
 * Field extraction from OCR raw text using Gemini on Vertex AI.
 * Uses the deployer's OAuth token (cloud-platform scope) — no API key.
 */

var GEMINI_INVOICE_FIELDS = [
  'supplier_name',
  'supplier_tax_id',
  'invoice_no',
  'invoice_date',
  'due_date',
  'subtotal',
  'vat',
  'total',
  'currency'
];

function extractInvoiceFieldsWithGemini_(rawText) {
  var invoice = buildEmptyInvoice_();

  if (!rawText) {
    return invoice;
  }

  assertConfigured_('PROJECT_ID');
  assertConfigured_('GEMINI_LOCATION');
  assertConfigured_('GEMINI_MODEL');

  var extracted = callGeminiForInvoice_(rawText);

  GEMINI_INVOICE_FIELDS.forEach(function (field) {
    var item = extracted[field];
    if (item && typeof item === 'object') {
      invoice[field] = createField_(item.value, Number(item.confidence || 0));
    }
  });

  invoice.currency.value = invoice.currency.value || 'THB';
  return invoice;
}

function buildEmptyInvoice_() {
  return {
    supplier_name: createField_('', 0),
    supplier_tax_id: createField_('', 0),
    invoice_no: createField_('', 0),
    invoice_date: createField_('', 0),
    due_date: createField_('', 0),
    subtotal: createField_('', 0),
    vat: createField_('', 0),
    total: createField_('', 0),
    currency: createField_('THB', 0)
  };
}

function callGeminiForInvoice_(rawText) {
  var endpoint = 'https://' + CONFIG.GEMINI_LOCATION + '-aiplatform.googleapis.com/v1/projects/' +
    encodeURIComponent(CONFIG.PROJECT_ID) + '/locations/' +
    encodeURIComponent(CONFIG.GEMINI_LOCATION) + '/publishers/google/models/' +
    encodeURIComponent(CONFIG.GEMINI_MODEL) + ':generateContent';

  var payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildGeminiPrompt_(rawText) }]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json'
    }
  };

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
    throw new Error('Gemini API error ' + status + ': ' + body);
  }

  return parseGeminiInvoiceResponse_(body);
}

function parseGeminiInvoiceResponse_(body) {
  var parsed = JSON.parse(body);
  var candidates = parsed.candidates || [];
  var content = candidates[0] && candidates[0].content;
  var parts = content && content.parts;
  var text = parts && parts[0] && parts[0].text;

  if (!text) {
    throw new Error('Gemini returned no content for invoice extraction.');
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Gemini returned non-JSON content: ' + text);
  }
}

function buildGeminiPrompt_(rawText) {
  return [
    'You extract structured invoice data from OCR text of a Thai or English invoice.',
    'Return ONLY a JSON object. For each field return an object {"value": string, "confidence": number}.',
    'Fields: supplier_name, supplier_tax_id, invoice_no, invoice_date, due_date, subtotal, vat, total, currency.',
    'Rules:',
    '- Keep values exactly as they appear in the document (do not reformat dates or amounts).',
    '- supplier_name is the seller/vendor issuing the invoice (may be in Thai).',
    '- supplier_tax_id is the seller tax id (เลขประจำตัวผู้เสียภาษี), digits.',
    '- currency: use the document currency code, default "THB" if unclear.',
    '- confidence is 0-1: how certain you are of the value.',
    '- If a field is not present, use "" and confidence 0.',
    '- Do not invent values that are not supported by the text.',
    '',
    'OCR text:',
    rawText
  ].join('\n');
}
