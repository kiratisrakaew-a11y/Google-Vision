/**
 * Central configuration for the invoice OCR web app.
 * Replace placeholder IDs before deploying.
 */
const CONFIG = {
  SHEET_ID: 'PUT_YOUR_SHEET_ID_HERE',
  SHEET_NAME: 'Invoices',
  LOG_SHEET_NAME: 'Logs',
  DRIVE_FOLDER_ID: 'PUT_YOUR_DRIVE_FOLDER_ID_HERE',
  DOCUMENT_JSON_FOLDER_ID: '',
  PROJECT_ID: 'PUT_YOUR_PROJECT_ID_HERE',
  GEMINI_LOCATION: 'us-central1',
  GEMINI_MODEL: 'gemini-2.5-flash',
  OVERALL_CONFIDENCE_THRESHOLD: 0.80,
  AMOUNT_TOLERANCE: 1,
  VAT_RATE: 0.07,
  OCR_LANGUAGE_HINTS: ['th', 'en'],
  MAX_DOCUMENT_JSON_CHARS: 45000
};

const INVOICE_FIELD_NAMES = [
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

const FIELD_THRESHOLDS = {
  supplier_name: 0.75,
  supplier_tax_id: 0.80,
  invoice_no: 0.80,
  invoice_date: 0.75,
  subtotal: 0.70,
  vat: 0.70,
  total: 0.85
};

const CONFIDENCE_WEIGHTS = {
  supplier_name: 0.15,
  supplier_tax_id: 0.15,
  invoice_no: 0.20,
  invoice_date: 0.15,
  subtotal: 0.10,
  vat: 0.10,
  total: 0.15
};

const REQUIRED_FIELDS = [
  'supplier_name',
  'supplier_tax_id',
  'invoice_no',
  'invoice_date',
  'total'
];

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png'
];

const INVOICE_HEADERS = [
  'Timestamp',
  'File Name',
  'File URL',
  'Supplier Name',
  'Supplier Tax ID',
  'Invoice No',
  'Invoice Date',
  'Due Date',
  'Subtotal',
  'VAT',
  'Total',
  'Currency',
  'Overall Confidence',
  'Lowest Field Confidence',
  'Review Status',
  'Missing Fields',
  'Low Confidence Fields',
  'Raw Text',
  'Document AI JSON',
  'Error Message',
  'Reviewed By',
  'Reviewed At',
  'Final Status',
  'Correction Notes'
];

const LOG_HEADERS = [
  'Timestamp',
  'Level',
  'File Name',
  'Step',
  'Message',
  'Error Detail'
];

function isConfigured_(key) {
  return Boolean(CONFIG[key]) && String(CONFIG[key]).indexOf('PUT_YOUR_') !== 0;
}
