# คู่มือ Setup Google Document AI + Gemini สำหรับ Invoice OCR App

คู่มือนี้อธิบายวิธีเชื่อม Google Apps Script Web App ใน repo นี้กับ Google Cloud เพื่อให้ flow ทำงานครบตั้งแต่ upload invoice, save ไฟล์ลง Drive, อ่านข้อความด้วย Document AI (Document OCR), ดึงฟิลด์ invoice ด้วย Gemini (Vertex AI), validate confidence และบันทึกลง Google Sheet

ระบบใช้ 2 ขั้นตอนแยกกัน:

1. **Document AI — Document OCR processor**: อ่านข้อความจากไฟล์ (รองรับภาษาไทยด้วย language hints)
2. **Gemini บน Vertex AI**: ดึงฟิลด์ invoice (supplier_name, invoice_no, total ฯลฯ) จากข้อความที่ OCR ได้

> เดิมระบบเคยใช้ Document AI **Invoice Parser** เพื่อดึงฟิลด์โดยตรง แต่ Invoice Parser จับข้อความไทยไม่ได้ดีและปฏิเสธการตั้งค่า OCR language hint (error `400 OCR_CONFIG_UNSUPPORTED`) จึงเปลี่ยนมาใช้ Document OCR + Gemini แทน

## 1. สิ่งที่ต้องมีก่อนเริ่ม

ต้องเตรียมรายการต่อไปนี้:

- Google Cloud Project ที่เปิดใช้ทั้ง **Document AI API** และ **Vertex AI API**
- Google Sheet สำหรับเก็บผลลัพธ์ invoice
- Google Drive folder สำหรับเก็บไฟล์ invoice ต้นฉบับ
- Apps Script project ที่มีไฟล์จาก repo นี้
- Account ที่ deploy Apps Script และมีสิทธิ์เรียก Document AI + Vertex AI ใน Google Cloud Project

ค่าที่ต้องนำมาใส่ใน `Config.gs`:

| ค่า | ใช้ทำอะไร | ตัวอย่าง |
| --- | --- | --- |
| `SHEET_ID` | Google Sheet ที่จะ append invoice row | `1abc...xyz` |
| `DRIVE_FOLDER_ID` | Drive folder สำหรับเก็บ invoice upload | `1folder...xyz` |
| `DOCUMENT_JSON_FOLDER_ID` | Drive folder สำหรับเก็บ Document AI JSON ขนาดใหญ่ ถ้าเว้นว่างจะใช้ `DRIVE_FOLDER_ID` | `1json...xyz` หรือ `''` |
| `PROJECT_ID` | Google Cloud Project ID | `my-invoice-project` |
| `LOCATION` | Region ของ Document AI **Document OCR** processor | `us` |
| `PROCESSOR_ID` | Document OCR processor ID (ไม่ใช่ Invoice Parser) | `1234567890abcdef` |
| `GEMINI_LOCATION` | Region ของ Vertex AI ที่จะเรียก Gemini | `us-central1` |
| `GEMINI_MODEL` | ชื่อ Gemini model บน Vertex AI | `gemini-2.5-flash` |
| `OCR_LANGUAGE_HINTS` | ภาษาที่ใบ้ให้ OCR อ่าน (BCP-47) | `['th', 'en']` |

## 2. เปิดใช้งาน API ที่จำเป็น

ใน Google Cloud Console:

1. เลือก Google Cloud Project ที่ต้องการใช้
2. ไปที่ **APIs & Services**
3. เลือก **Enable APIs and Services**
4. ค้นหาและเปิดใช้งาน **Document AI API**
5. ค้นหาและเปิดใช้งาน **Vertex AI API** (จำเป็นสำหรับเรียก Gemini)
6. ตรวจสอบว่า billing ของ project พร้อมใช้งาน เพราะ Document AI และ Vertex AI เป็นบริการที่มีค่าใช้จ่ายตาม usage

## 3. สร้าง Document OCR Processor

ใน Google Cloud Console:

1. ไปที่ **Document AI**
2. เลือก **Processors** → **Create Processor**
3. เลือก processor ประเภท **Document OCR** (อยู่ในหมวด OCR/General — **ไม่ใช่** Invoice Parser)
4. เลือก region เช่น `us`
5. ตั้งชื่อ processor เช่น `thai-ocr`
6. หลังสร้างเสร็จ ให้จดค่า:
   - `PROJECT_ID`
   - `LOCATION`
   - `PROCESSOR_ID`

> **ทำไมไม่ใช้ Invoice Parser:** Invoice Parser ปฏิเสธ `processOptions.ocrConfig` (ที่ใช้ตั้ง language hints ภาษาไทย) ด้วย error `400 OCR_CONFIG_UNSUPPORTED` และ entity extraction ของมันไม่รองรับข้อความไทยดีพอ ระบบนี้จึงใช้ Document OCR อ่านข้อความอย่างเดียว แล้วให้ Gemini เป็นตัวดึงฟิลด์แทน

ตัวอย่าง endpoint ที่ code จะเรียก:

```text
https://us-documentai.googleapis.com/v1/projects/my-invoice-project/locations/us/processors/1234567890abcdef:process
```

## 4. ให้สิทธิ์ account ที่รัน Apps Script

ระบบนี้ใช้ OAuth token จาก Apps Script ผ่าน `ScriptApp.getOAuthToken()` ทั้งตอนเรียก Document AI และ Gemini/Vertex AI ดังนั้น account ที่เป็น owner/deployer ของ Apps Script ต้องมีสิทธิ์ใน Google Cloud Project ทั้งสองบริการ

แนะนำให้ให้ role อย่างน้อย:

```text
Document AI API User
Vertex AI User
```

ถ้าองค์กรมี policy เฉพาะ ให้ใช้ custom role ที่สามารถเรียก Document AI `:process` และ Vertex AI `:generateContent` endpoint ได้

อาการที่บ่งชี้ว่าสิทธิ์ไม่พอ:

```text
Document AI API error 403: Permission denied
Gemini API error 403: ...
```

## 5. สร้าง Google Sheet

1. สร้าง Google Sheet ใหม่
2. ตั้งชื่อเช่น `Invoice OCR Results`
3. Copy `SHEET_ID` จาก URL:

```text
https://docs.google.com/spreadsheets/d/SHEET_ID/edit
```

ระบบจะ auto-create และ sync headers ให้กับ sheet ชื่อ:

```text
Invoices
Logs
```

ถ้าต้องการเปลี่ยนชื่อ sheet หลัก ให้แก้ `CONFIG.SHEET_NAME` ใน `Config.gs`

## 6. สร้าง Google Drive Folder

1. สร้าง folder เช่น `Invoice Uploads`
2. Copy folder ID จาก URL:

```text
https://drive.google.com/drive/folders/DRIVE_FOLDER_ID
```

ใช้ folder นี้สำหรับ:

- เก็บ invoice upload ต้นฉบับ
- เก็บ Document AI JSON ขนาดใหญ่ ถ้าไม่ได้กำหนด `DOCUMENT_JSON_FOLDER_ID`

แนะนำจำกัดสิทธิ์ folder นี้เฉพาะทีมที่เกี่ยวข้อง เช่น accounting/admin/system owner

## 7. ตั้งค่า `Config.gs`

เปิด `Config.gs` แล้วเปลี่ยน placeholder เป็นค่าจริง:

```javascript
const CONFIG = {
  SHEET_ID: 'PUT_YOUR_SHEET_ID_HERE',
  SHEET_NAME: 'Invoices',
  LOG_SHEET_NAME: 'Logs',
  DRIVE_FOLDER_ID: 'PUT_YOUR_DRIVE_FOLDER_ID_HERE',
  DOCUMENT_JSON_FOLDER_ID: '',
  PROJECT_ID: 'PUT_YOUR_PROJECT_ID_HERE',
  LOCATION: 'us',
  PROCESSOR_ID: 'PUT_YOUR_PROCESSOR_ID_HERE',
  GEMINI_LOCATION: 'us-central1',
  GEMINI_MODEL: 'gemini-2.5-flash',
  OVERALL_CONFIDENCE_THRESHOLD: 0.80,
  AMOUNT_TOLERANCE: 1,
  VAT_RATE: 0.07,
  OCR_LANGUAGE_HINTS: ['th', 'en'],
  MAX_DOCUMENT_JSON_CHARS: 45000
};
```

ตัวอย่างหลังตั้งค่า:

```javascript
const CONFIG = {
  SHEET_ID: '1abcxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  SHEET_NAME: 'Invoices',
  LOG_SHEET_NAME: 'Logs',
  DRIVE_FOLDER_ID: '1folderxxxxxxxxxxxxxxxxxxxxxxxx',
  DOCUMENT_JSON_FOLDER_ID: '',
  PROJECT_ID: 'my-invoice-project',
  LOCATION: 'us',
  PROCESSOR_ID: '1234567890abcdef',
  GEMINI_LOCATION: 'us-central1',
  GEMINI_MODEL: 'gemini-2.5-flash',
  OVERALL_CONFIDENCE_THRESHOLD: 0.80,
  AMOUNT_TOLERANCE: 1,
  VAT_RATE: 0.07,
  OCR_LANGUAGE_HINTS: ['th', 'en'],
  MAX_DOCUMENT_JSON_CHARS: 45000
};
```

## 8. ตรวจสอบ OAuth scopes

ไฟล์ `appsscript.json` ต้องมี scopes เหล่านี้:

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

ความหมาย:

| Scope | เหตุผล |
| --- | --- |
| `script.external_request` | ให้ `UrlFetchApp.fetch()` เรียก Document AI และ Vertex AI REST API ได้ |
| `cloud-platform` | ให้ OAuth token เรียกทั้ง Google Cloud Document AI และ Vertex AI (Gemini) ได้ ไม่ต้องมี API key แยก |
| `drive` | ให้ save invoice และ JSON audit files ลง Drive ได้ |
| `spreadsheets` | ให้ append result และ logs ลง Google Sheet ได้ |

## 9. Deploy Apps Script เป็น Web App

ใน Apps Script Editor:

1. กด **Deploy**
2. เลือก **New deployment**
3. เลือก type เป็น **Web app**
4. ตั้งค่า:

```text
Execute as: Me
Who has access: Anyone within organization
```

ไม่แนะนำเปิดเป็น `Anyone` ถ้า invoice เป็นข้อมูลภายในองค์กร เพราะมีข้อมูล sensitive เช่น tax ID, vendor, address และยอดเงิน

หลัง deploy ให้เปิด Web App URL แล้ว upload invoice เพื่อทดสอบ

## 10. Flow การทำงานหลัง setup สำเร็จ

เมื่อ user upload invoice ผ่านหน้าเว็บ:

```text
Index.html
  -> google.script.run.uploadInvoice(payload)
  -> Code.gs validates payload
  -> Save file to Drive
  -> DocumentAi.gs sends rawDocument (+ languageHints) to Document OCR processor
  -> Gemini.gs extracts invoice fields from OCR raw text via Vertex AI (Gemini)
  -> InvoiceMapper.gs normalizes fields (tax id, dates, amounts, currency)
  -> Validation.gs calculates confidence and review status
  -> SheetService.gs checks duplicate and appends row
  -> UI shows extracted fields and confidence
```

## 11. วิธีตรวจสอบว่าเชื่อม Document AI + Gemini ได้

หลัง upload invoice สำเร็จ ให้ตรวจสอบ:

1. มีไฟล์ invoice ถูกสร้างใน Drive folder
2. มี row ใหม่ใน sheet `Invoices`
3. Column `Raw Text` แสดงข้อความไทยถูกต้อง (ไม่ใช่ตัวอักษรมั่ว)
4. Column `Review Status` เป็น `OK`, `NEEDS_REVIEW`, หรือ `DUPLICATE`
5. Column `Document AI JSON` มี JSON หรือ Drive URL ของ JSON audit file
6. Sheet `Logs` มี event เช่น:

```text
UPLOAD
DRIVE
DOCUMENT_AI
GEMINI
SHEET
```

## 12. Error ที่พบบ่อย

### 12.1 Missing configuration value

ตัวอย่าง:

```text
Missing configuration value: CONFIG.PROJECT_ID
```

สาเหตุ:

- ยังไม่ได้แก้ placeholder ใน `Config.gs`

วิธีแก้:

- ใส่ `PROJECT_ID`, `PROCESSOR_ID`, `SHEET_ID`, `DRIVE_FOLDER_ID` ให้ครบ

### 12.2 403 Permission denied

สาเหตุที่พบบ่อย:

- Account ที่ deploy Apps Script ไม่มีสิทธิ์เรียก Document AI หรือ Vertex AI
- ยังไม่ได้ให้ role ใน Google Cloud IAM

วิธีแก้:

- เพิ่ม role `Document AI API User` (สำหรับ Document OCR) และ `Vertex AI User` (สำหรับ Gemini) ให้ account ที่ deploy Apps Script

### 12.3 404 Processor not found

สาเหตุที่พบบ่อย:

- `PROJECT_ID`, `LOCATION`, หรือ `PROCESSOR_ID` ไม่ตรงกัน
- Processor อยู่ region อื่น เช่น `eu` แต่ config ใส่ `us`

วิธีแก้:

- ตรวจค่า processor จาก Google Cloud Console แล้วแก้ `Config.gs`

### 12.4 400 OCR_CONFIG_UNSUPPORTED

ตัวอย่าง:

```text
Document AI API error 400: OcrConfig is not supported for processor type: 'INVOICE_PROCESSOR'.
```

สาเหตุ:

- `CONFIG.PROCESSOR_ID` ชี้ไปที่ processor ประเภท **Invoice Parser** แทนที่จะเป็น **Document OCR**

วิธีแก้:

- สร้าง processor ใหม่เป็นประเภท Document OCR ตามข้อ 3 แล้วแก้ `PROCESSOR_ID` ใน `Config.gs`

### 12.5 Gemini คืนค่าผิดรูปแบบ

ตัวอย่าง error ที่เจอใน `Error Message` / sheet `Logs`:

```text
Gemini returned an unexpected JSON shape for invoice extraction: ...
Gemini returned non-JSON content: ...
```

สาเหตุที่พบบ่อย:

- Vertex AI ตอบกลับมาไม่ตรงรูปแบบ JSON ที่คาดไว้ (เช่น model ปฏิเสธคำสั่งเพราะเนื้อหาผิดปกติ)
- `GEMINI_MODEL` หรือ `GEMINI_LOCATION` ตั้งค่าไม่ถูกต้อง

วิธีแก้:

- ตรวจสอบ `GEMINI_MODEL`/`GEMINI_LOCATION` ใน `Config.gs` ว่าถูกต้องและใช้งานได้ใน region ที่เลือก
- ลองอัปโหลดไฟล์เดิมซ้ำ หากเกิดซ้ำบ่อยให้ตรวจสอบเนื้อหา `Raw Text` ว่าผิดปกติหรือไม่

### 12.6 Unsupported file type

ระบบรองรับ MIME type:

```text
application/pdf
image/jpeg
image/png
```

ถ้า upload format อื่น ระบบจะ reject ที่ `validateUploadPayload_()`

### 12.7 JSON audit file ไม่ถูกสร้าง

ถ้า Document AI JSON ใหญ่มาก ระบบจะพยายามเก็บเป็นไฟล์ `.json` ใน Drive หากสร้างไฟล์ไม่ได้จะ fallback เป็น truncated text ใน Sheet

ตรวจสอบ:

- `DRIVE_FOLDER_ID` ถูกต้องหรือไม่
- Apps Script มี Drive scope หรือไม่
- Account ที่ deploy มีสิทธิ์ create file ใน folder หรือไม่

## 13. Checklist ก่อนใช้งานจริง

- [ ] เปิด Document AI API แล้ว
- [ ] เปิด Vertex AI API แล้ว
- [ ] สร้าง Document OCR processor แล้ว (ไม่ใช่ Invoice Parser)
- [ ] ใส่ `PROJECT_ID`, `LOCATION`, `PROCESSOR_ID` แล้ว
- [ ] ใส่ `GEMINI_LOCATION`, `GEMINI_MODEL` แล้ว
- [ ] ใส่ `SHEET_ID` แล้ว
- [ ] ใส่ `DRIVE_FOLDER_ID` แล้ว
- [ ] Account ที่ deploy มีสิทธิ์ `Document AI API User` แล้ว
- [ ] Account ที่ deploy มีสิทธิ์ `Vertex AI User` แล้ว
- [ ] Apps Script OAuth scopes ครบแล้ว
- [ ] Deploy เป็น Web App แล้ว
- [ ] ทดสอบ upload invoice จริงอย่างน้อย 5-10 ไฟล์ก่อนเริ่มใช้งาน (รวมไฟล์ภาษาไทย)
- [ ] ก่อน production ควรทดสอบ 30-50 invoices จากหลาย vendor/layout

## 14. คำแนะนำสำหรับ production

- จำกัดสิทธิ์ Web App ให้เฉพาะคนในองค์กรหรือทีมที่เกี่ยวข้อง
- จำกัดสิทธิ์ Drive folder และ Sheet
- อย่า hardcode secrets หรือ API keys ใน code
- ตั้ง review workflow สำหรับ invoice ที่ `NEEDS_REVIEW`
- ตรวจ accuracy แยกตาม field เช่น tax ID, invoice no, date, total
- ปรับ thresholds หลังทดสอบกับ invoice จริง — ค่า confidence จาก Gemini เป็นการประเมินของโมเดลเอง (ไม่ใช่ calibrated confidence per-entity แบบ Document AI เดิม) จึงควรทดสอบและปรับ `FIELD_THRESHOLDS` ให้เหมาะสม
- เปิด billing alert ใน Google Cloud เพื่อติดตามค่าใช้จ่าย Document AI และ Vertex AI (Gemini)
