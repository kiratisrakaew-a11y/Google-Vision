# AGENTS.md

## Project Mission

This repository is for a Google Apps Script web application that lets users upload unstructured invoice documents, processes them with Google Document AI Invoice Parser, extracts Thai/English invoice fields, calculates confidence and review status, and appends the result to Google Sheets.

Primary workflow:

```text
User uploads invoice
  -> Apps Script Web App receives file
  -> Save original file to Google Drive
  -> Send file to Document AI Invoice Parser
  -> Map Document AI entities to internal invoice fields
  -> Normalize and validate extracted values
  -> Calculate confidence metrics
  -> Decide OK / NEEDS_REVIEW / ERROR / DUPLICATE
  -> Append result to Google Sheet
  -> Show extracted result and confidence to user
```

## Recommended Apps Script File Structure

When implementing this project, prefer splitting Apps Script code into these files:

- `Code.gs` - web app entry points, including `doGet()` and `uploadInvoice(payload)`.
- `Config.gs` - project IDs, sheet/folder IDs, processor configuration, thresholds, and constants.
- `DocumentAi.gs` - Document AI API calls and response handling.
- `InvoiceMapper.gs` - mapping Document AI entities into the app's invoice data model.
- `Validation.gs` - normalization, validation, confidence calculation, and review status logic.
- `SheetService.gs` - Google Sheet append, duplicate detection, and audit log writes.
- `Index.html` - upload UI and client-side JavaScript.

Keep responsibilities separated. Do not put Document AI API logic, validation rules, and sheet-writing logic all in `Code.gs` unless this is only a very small prototype.

## Google Sheet Schema

The main sheet should be named `Invoices` unless a user explicitly asks otherwise. Use these columns for the first production-ready version:

```text
Timestamp
File Name
File URL
Supplier Name
Supplier Tax ID
Invoice No
Invoice Date
Due Date
Subtotal
VAT
Total
Currency
Overall Confidence
Lowest Field Confidence
Review Status
Missing Fields
Low Confidence Fields
Raw Text
Document AI JSON
Error Message
```

If manual review is implemented, add these columns:

```text
Reviewed By
Reviewed At
Final Status
Correction Notes
```

A separate `Logs` sheet is recommended for operational events:

```text
Timestamp
Level
File Name
Step
Message
Error Detail
```

## Required Internal Invoice Fields

Use this internal field naming consistently:

```javascript
{
  supplier_name: { value: '', confidence: 0 },
  supplier_tax_id: { value: '', confidence: 0 },
  invoice_no: { value: '', confidence: 0 },
  invoice_date: { value: '', confidence: 0 },
  due_date: { value: '', confidence: 0 },
  subtotal: { value: '', confidence: 0 },
  vat: { value: '', confidence: 0 },
  total: { value: '', confidence: 0 },
  currency: { value: 'THB', confidence: 0 }
}
```

## Document AI Entity Mapping

Map Document AI Invoice Parser entities to internal fields as follows. Entity names can vary by processor version, so keep aliases easy to update in one place.

| Internal field | Document AI entity type candidates |
| --- | --- |
| `supplier_name` | `supplier_name` |
| `supplier_tax_id` | `supplier_tax_id` |
| `invoice_no` | `invoice_id` |
| `invoice_date` | `invoice_date` |
| `due_date` | `due_date` |
| `subtotal` | `net_amount`, `subtotal` |
| `vat` | `total_tax_amount`, `tax_amount` |
| `total` | `total_amount`, `amount_due` |
| `currency` | `currency` |

When extracting a field:

1. Prefer `normalizedValue.text` when present.
2. Fall back to `mentionText`.
3. If multiple entities match the same field, select the highest-confidence candidate unless a field-specific rule says otherwise.
4. Preserve the original full Document AI JSON in the sheet for audit/debugging.

## Confidence Rules

Document AI provides confidence per entity. The app should also calculate its own invoice-level metrics.

### Weighted Overall Confidence

Use missing fields as confidence `0`. Start with these weights:

| Field | Weight |
| --- | ---: |
| `supplier_name` | 0.15 |
| `supplier_tax_id` | 0.15 |
| `invoice_no` | 0.20 |
| `invoice_date` | 0.15 |
| `subtotal` | 0.10 |
| `vat` | 0.10 |
| `total` | 0.15 |

### Field Thresholds

Start with these thresholds and adjust after testing real invoices:

```javascript
const FIELD_THRESHOLDS = {
  supplier_name: 0.75,
  supplier_tax_id: 0.80,
  invoice_no: 0.80,
  invoice_date: 0.75,
  subtotal: 0.70,
  vat: 0.70,
  total: 0.85
};
```

Use `0.80` as the initial overall confidence threshold.

Required fields for review decisions:

```text
supplier_name
supplier_tax_id
invoice_no
invoice_date
total
```

Set review status using this order:

1. If processing throws an error, status is `ERROR`.
2. If a duplicate invoice is found, status is `DUPLICATE` or `NEEDS_REVIEW`, based on the user's workflow preference.
3. If any required field is missing, status is `NEEDS_REVIEW`.
4. If any required field is below its threshold, status is `NEEDS_REVIEW`.
5. If overall confidence is below `0.80`, status is `NEEDS_REVIEW`.
6. If amount consistency checks fail, status is `NEEDS_REVIEW`.
7. Otherwise, status is `OK`.

Do not rely on overall confidence alone. A single critical field such as `supplier_tax_id`, `invoice_no`, or `total` can require review even when the average confidence is high.

## Validation and Normalization Rules

Normalize values before writing them to the main user-facing columns.

### Thai Tax ID

- Remove all non-digits.
- Expected format is 13 digits.
- Invalid or missing tax IDs should cause `NEEDS_REVIEW` for accounting workflows.

### Dates

Normalize invoice and due dates to `YYYY-MM-DD` when possible. Support common Thai and international forms, including:

```text
05/07/2569
05/07/2026
5 กรกฎาคม 2569
2026-07-05
```

If the year appears to be Buddhist Era, convert to Common Era:

```text
BE year - 543 = CE year
```

### Amounts

Normalize money amounts to plain decimals without currency symbols or thousands separators:

```text
฿10,700.00 -> 10700.00
10,700.00 บาท -> 10700.00
THB 10,700.00 -> 10700.00
```

### VAT and Total Consistency

When subtotal, VAT, and total are all present, check:

```text
subtotal + vat ~= total
```

Use a small tolerance, such as 1 baht, to allow rounding differences.

For Thai VAT invoices, optionally flag if:

```text
vat ~= subtotal * 0.07
```

Do not hard-fail solely on this rule because some invoices may include VAT exemptions, discounts, withholding tax, or rounding adjustments.

### Duplicate Detection

Use this duplicate key:

```text
supplier_tax_id + invoice_no
```

If either field is missing, do not mark as duplicate automatically; mark for review instead.

## Document AI Integration Guidelines

For Apps Script, prefer calling Document AI with `UrlFetchApp` and `ScriptApp.getOAuthToken()`:

```text
https://LOCATION-documentai.googleapis.com/v1/projects/PROJECT_ID/locations/LOCATION/processors/PROCESSOR_ID:process
```

Request body should use `rawDocument`:

```json
{
  "rawDocument": {
    "content": "BASE64_CONTENT",
    "mimeType": "application/pdf"
  }
}
```

Required header:

```text
Authorization: Bearer ACCESS_TOKEN
Content-Type: application/json
```

The Apps Script manifest should include the required OAuth scope, commonly:

```text
https://www.googleapis.com/auth/cloud-platform
```

Also include only the Drive and Sheets scopes the implementation actually needs.

## Upload UI Requirements

The first upload UI should support:

- PDF, JPG, JPEG, and PNG files.
- Clear upload/progress status.
- Extracted values displayed back to the user.
- Per-field confidence display.
- Review status display using simple visual states:
  - `OK` as green.
  - `NEEDS_REVIEW` or `DUPLICATE` as yellow/orange.
  - `ERROR` as red.
- A link to the uploaded Drive file after processing.

For production or sensitive data, do not deploy the web app publicly as `Anyone` unless explicitly requested and approved by the project owner.

## Error Handling and Audit Requirements

Always handle and record errors from these stages:

- Upload validation.
- Drive file creation.
- Document AI API calls.
- Entity mapping.
- Normalization and validation.
- Duplicate checks.
- Sheet writes.

Even when processing fails, write an audit row to the sheet when possible with:

```text
Review Status = ERROR
Error Message = <meaningful message>
```

Avoid logging excessive sensitive data in Apps Script logs. Store the original document in Drive and the full Document AI JSON in the configured sheet only if access controls are appropriate.

## Security Guidelines

Invoices may contain tax IDs, addresses, vendor information, and payment amounts. Implementations must:

- Restrict Google Drive folder permissions to the relevant team.
- Restrict Google Sheet permissions to the relevant team.
- Prefer organization-only web app access for internal systems.
- Avoid hardcoding API keys or secrets.
- Prefer OAuth/service account permissions over static secrets.
- Do not expose Document AI processor IDs, project IDs, or raw JSON unnecessarily in the browser UI.

## Testing Plan

Before production, test with at least 30-50 real or representative invoices covering:

- Digital PDFs.
- Scanned PDFs.
- JPG/PNG invoices.
- Thai language invoices.
- English or mixed-language invoices.
- Multiple vendors and layouts.
- Blurry, skewed, or low-quality scans.
- Invoices with VAT.
- Invoices without VAT.
- Multi-page invoices.
- Duplicate invoices.
- Non-invoice files.

Track accuracy by field:

```text
invoice_no accuracy
supplier_name accuracy
supplier_tax_id accuracy
invoice_date accuracy
total accuracy
missing count
wrong count
low-confidence count
```

Use test results to tune thresholds and mapping aliases.

## Implementation Milestones

1. Prototype upload flow: Web App upload, Drive save, Document AI call, append raw result to Sheet.
2. Field mapping: map key invoice entities into internal fields and sheet columns.
3. Confidence and review status: calculate overall confidence, missing fields, low-confidence fields, and status.
4. Validation: normalize Thai dates, Thai tax IDs, amounts, VAT/total checks, and duplicate detection.
5. Manual review: add review columns and correction tracking.
6. Production hardening: logging, error handling, permissions, quotas, and larger test set.
7. Optional fallback: use Gemini only for low-confidence normalization or review suggestions, not as the sole source of truth unless requested.

## Coding Style

- Keep configuration centralized in `Config.gs`.
- Keep field names stable and documented.
- Prefer small, testable helper functions.
- Never put `try/catch` blocks around imports.
- Do not hardcode secrets or private IDs in shared examples; use placeholders or script properties.
- Use clear status strings exactly as documented: `OK`, `NEEDS_REVIEW`, `ERROR`, and optionally `DUPLICATE`.
