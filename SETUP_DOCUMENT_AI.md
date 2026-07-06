# คู่มือ Setup Google Document AI สำหรับ Invoice OCR App

คู่มือนี้อธิบายวิธีเชื่อม Google Apps Script Web App ใน repo นี้กับ Google Document AI Invoice Parser เพื่อให้ flow ทำงานครบตั้งแต่ upload invoice, save ไฟล์ลง Drive, เรียก Document AI, extract field, validate confidence และบันทึกลง Google Sheet

## 1. สิ่งที่ต้องมีก่อนเริ่ม

ต้องเตรียมรายการต่อไปนี้:

- Google Cloud Project สำหรับ Document AI
- Google Sheet สำหรับเก็บผลลัพธ์ invoice
- Google Drive folder สำหรับเก็บไฟล์ invoice ต้นฉบับ
- Apps Script project ที่มีไฟล์จาก repo นี้
- Account ที่ deploy Apps Script และมีสิทธิ์เรียก Document AI ใน Google Cloud Project

ค่าที่ต้องนำมาใส่ใน `Config.gs`:

| ค่า | ใช้ทำอะไร | ตัวอย่าง |
| --- | --- | --- |
| `SHEET_ID` | Google Sheet ที่จะ append invoice row | `1abc...xyz` |
| `DRIVE_FOLDER_ID` | Drive folder สำหรับเก็บ invoice upload | `1folder...xyz` |
| `DOCUMENT_JSON_FOLDER_ID` | Drive folder สำหรับเก็บ Document AI JSON ขนาดใหญ่ ถ้าเว้นว่างจะใช้ `DRIVE_FOLDER_ID` | `1json...xyz` หรือ `''` |
| `PROJECT_ID` | Google Cloud Project ID | `my-invoice-project` |
| `LOCATION` | Region ของ Document AI processor | `us` |
| `PROCESSOR_ID` | Invoice Parser processor ID | `1234567890abcdef` |

## 2. เปิดใช้งาน Document AI API

ใน Google Cloud Console:

1. เลือก Google Cloud Project ที่ต้องการใช้
2. ไปที่ **APIs & Services**
3. เลือก **Enable APIs and Services**
4. ค้นหาและเปิดใช้งาน **Document AI API**
5. ตรวจสอบว่า billing ของ project พร้อมใช้งาน เพราะ Document AI เป็นบริการที่มีค่าใช้จ่ายตาม usage

## 3. สร้าง Invoice Parser Processor

ใน Google Cloud Console:

1. ไปที่ **Document AI**
2. เลือก **Processors**
3. กด **Create Processor**
4. เลือก processor ประเภท **Invoice Parser**
5. เลือก region เช่น `us`
6. ตั้งชื่อ processor เช่น `invoice-parser`
7. หลังสร้างเสร็จ ให้จดค่า:
   - `PROJECT_ID`
   - `LOCATION`
   - `PROCESSOR_ID`

ตัวอย่าง endpoint ที่ code จะเรียก:

```text
https://us-documentai.googleapis.com/v1/projects/my-invoice-project/locations/us/processors/1234567890abcdef:process
```

## 4. ให้สิทธิ์ account ที่รัน Apps Script

ระบบนี้ใช้ OAuth token จาก Apps Script ผ่าน `ScriptApp.getOAuthToken()` ดังนั้น account ที่เป็น owner/deployer ของ Apps Script ต้องมีสิทธิ์ใน Google Cloud Project

แนะนำให้ให้ role อย่างน้อย:

```text
Document AI API User
```

ถ้าองค์กรมี policy เฉพาะ ให้ใช้ custom role ที่สามารถเรียก processor endpoint ได้

อาการที่บ่งชี้ว่าสิทธิ์ไม่พอ:

```text
Document AI API error 403: Permission denied
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
  OVERALL_CONFIDENCE_THRESHOLD: 0.80,
  AMOUNT_TOLERANCE: 1,
  VAT_RATE: 0.07,
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
  OVERALL_CONFIDENCE_THRESHOLD: 0.80,
  AMOUNT_TOLERANCE: 1,
  VAT_RATE: 0.07,
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
| `script.external_request` | ให้ `UrlFetchApp.fetch()` เรียก Document AI REST API ได้ |
| `cloud-platform` | ให้ OAuth token เรียก Google Cloud / Document AI ได้ |
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
  -> DocumentAi.gs sends rawDocument to Document AI
  -> InvoiceMapper.gs maps entities
  -> Validation.gs normalizes and validates fields
  -> SheetService.gs checks duplicate and appends row
  -> UI shows extracted fields and confidence
```

## 11. วิธีตรวจสอบว่าเชื่อม Document AI ได้

หลัง upload invoice สำเร็จ ให้ตรวจสอบ:

1. มีไฟล์ invoice ถูกสร้างใน Drive folder
2. มี row ใหม่ใน sheet `Invoices`
3. Column `Review Status` เป็น `OK`, `NEEDS_REVIEW`, หรือ `DUPLICATE`
4. Column `Document AI JSON` มี JSON หรือ Drive URL ของ JSON audit file
5. Sheet `Logs` มี event เช่น:

```text
UPLOAD
DRIVE
DOCUMENT_AI
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

- Account ที่ deploy Apps Script ไม่มีสิทธิ์เรียก Document AI
- ยังไม่ได้ให้ role ใน Google Cloud IAM

วิธีแก้:

- เพิ่ม role `Document AI API User` ให้ account ที่ deploy Apps Script

### 12.3 404 Processor not found

สาเหตุที่พบบ่อย:

- `PROJECT_ID`, `LOCATION`, หรือ `PROCESSOR_ID` ไม่ตรงกัน
- Processor อยู่ region อื่น เช่น `eu` แต่ config ใส่ `us`

วิธีแก้:

- ตรวจค่า processor จาก Google Cloud Console แล้วแก้ `Config.gs`

### 12.4 Unsupported file type

ระบบรองรับ MIME type:

```text
application/pdf
image/jpeg
image/png
```

ถ้า upload format อื่น ระบบจะ reject ที่ `validateUploadPayload_()`

### 12.5 JSON audit file ไม่ถูกสร้าง

ถ้า Document AI JSON ใหญ่มาก ระบบจะพยายามเก็บเป็นไฟล์ `.json` ใน Drive หากสร้างไฟล์ไม่ได้จะ fallback เป็น truncated text ใน Sheet

ตรวจสอบ:

- `DRIVE_FOLDER_ID` ถูกต้องหรือไม่
- Apps Script มี Drive scope หรือไม่
- Account ที่ deploy มีสิทธิ์ create file ใน folder หรือไม่

## 13. Checklist ก่อนใช้งานจริง

- [ ] เปิด Document AI API แล้ว
- [ ] สร้าง Invoice Parser processor แล้ว
- [ ] ใส่ `PROJECT_ID`, `LOCATION`, `PROCESSOR_ID` แล้ว
- [ ] ใส่ `SHEET_ID` แล้ว
- [ ] ใส่ `DRIVE_FOLDER_ID` แล้ว
- [ ] Account ที่ deploy มีสิทธิ์ Document AI แล้ว
- [ ] Apps Script OAuth scopes ครบแล้ว
- [ ] Deploy เป็น Web App แล้ว
- [ ] ทดสอบ upload invoice จริงอย่างน้อย 5-10 ไฟล์ก่อนเริ่มใช้งาน
- [ ] ก่อน production ควรทดสอบ 30-50 invoices จากหลาย vendor/layout

## 14. คำแนะนำสำหรับ production

- จำกัดสิทธิ์ Web App ให้เฉพาะคนในองค์กรหรือทีมที่เกี่ยวข้อง
- จำกัดสิทธิ์ Drive folder และ Sheet
- อย่า hardcode secrets หรือ API keys ใน code
- ตั้ง review workflow สำหรับ invoice ที่ `NEEDS_REVIEW`
- ตรวจ accuracy แยกตาม field เช่น tax ID, invoice no, date, total
- ปรับ thresholds หลังทดสอบกับ invoice จริง
- เปิด billing alert ใน Google Cloud เพื่อติดตามค่าใช้จ่าย Document AI
