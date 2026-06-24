# PTT OFI Ultimate Integration Dashboard

แดชบอร์ดติดตามและจัดการแผนปรับปรุงการทำงาน (OFI - Opportunity for Improvement) ของ PTT สำหรับการประเมินคุณภาพในด้านต่างๆ โค้ดได้รับการปรับปรุงโครงสร้างเป็น **OOP (Object-Oriented Programming)** และ **Clean Architecture** เพื่อให้อ่านง่าย ขยายระบบง่าย และคงทนในการบำรุงรักษาในระยะยาว

---

## 📂 โครงสร้างการเขียนโค้ด (Clean OOP Architecture)

โปรเจกต์แบ่งออกเป็นชั้นต่างๆ เพื่อให้แยกหน้าที่ความรับผิดชอบอย่างชัดเจน (Separation of Concerns):

```text
ofi-dashboard-main/
├── backend/
│   ├── api/                 # Controller Layer (FastAPI API Routers)
│   │   ├── deps.py          # Dependencies (Database sessions, Auth checking)
│   │   └── v1/endpoints/    # API endpoints แยกตามหมวดหมู่
│   │       ├── dashboard.py # API ข้อมูลแดชบอร์ด รายชื่อ Owner และสถิติ
│   │       ├── export.py    # API ส่งออกรายงาน PDF/JPG ผ่าน Playwright
│   │       ├── files.py     # API จัดการไฟล์อัปโหลด (Upload, List, Delete, Toggle)
│   │       └── settings.py  # API จัดการตั้งค่าระบบและสิทธิ์การแสดงผลกราฟ
│   ├── core/                # System Configuration & Database initialization
│   │   ├── config.py        # Settings class จัดการตัวแปรแวดล้อมและพาร์ทระบบ
│   │   └── database.py      # DatabaseManager จัดการ Connection และ session
│   ├── models/              # Data Models
│   │   ├── ofi.py           # SQLAlchemy declarative database models
│   │   └── schemas.py       # Pydantic validation schemas (Request/Response)
│   ├── repositories/        # Data Access Layer (Repository Pattern)
│   │   ├── ofi_repository.py      # คิวรีข้อมูลแผนงานจาก SQLite
│   │   └── settings_repository.py # โหลด/เซฟไฟล์ JSON ของระบบและ Metadata
│   ├── services/            # Business Logic Layer
│   │   ├── pdf_export_service.py  # บริการจำลองหน้าเว็บและบันทึก PDF/JPG
│   │   └── pipeline_service.py    # บริการดึง นำเข้า Normalization และ Sync ข้อมูล
│   └── main.py              # Application Entry Point (FastAPI app)
│
├── frontend/                # Client-Side Application (HTML Views, CSS, JS)
│   ├── js/
│   │   ├── apps/            # Logic หลักของหน้าจอแยกตามบทบาท (admin_app.js, ฯลฯ)
│   │   ├── services/        # บริการฝั่ง Client (dataService.js ดึง API)
│   │   ├── utils/           # ฟังก์ชันช่วยเหลือและตัววาดกราฟ (chartRenderers.js)
│   │   └── views/           # หน้าต่างแสดงข้อมูลและ UI เรนเดอร์ (executive.js, ฯลฯ)
│   ├── index.html           # หน้าแรกของแดชบอร์ด (การเข้าสู่ระบบ/เลือกสิทธิ์)
│   ├── admin.html           # หน้าจอผู้ดูแลระบบ (จัดไฟล์และสิทธิ์กราฟ)
│   ├── executive.html       # หน้าจอผู้บริหาร
│   ├── auditor.html         # หน้าจอผู้ประเมิน
│   └── owner.html           # หน้าจอเจ้าของหัวข้อ (Process Owner)
└── data/                    # โฟลเดอร์เก็บข้อมูล SQLite DB และการตั้งค่า JSON
```

---

## 🚀 วิธีการ Run Server & Run Database

แดชบอร์ดตัวนี้ขับเคลื่อนโดยสองฝั่งหลักๆ คือ Backend (FastAPI + SQLite) และ Frontend (Vite Static Files)

### 1. การเตรียมสภาพแวดล้อม (Setup)
เปิดโปรแกรม Terminal หรือ PowerShell ในโฟลเดอร์โปรเจกต์นี้ จากนั้นรันคำสั่งตามลำดับ:

1. **สร้างและเรียกใช้ Python Virtual Environment (venv):**
   ```powershell
   # สำหรับ Windows PowerShell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
2. **ติดตั้ง Python Libraries ฝั่ง Backend:**
   ```bash
   pip install -r requirements.txt
   ```
3. **ติดตั้งเบราว์เซอร์จำลองสำหรับการ Export PDF/JPG (Playwright):**
   ```bash
   playwright install
   ```
4. **ติดตั้ง Node Modules ฝั่ง Frontend:**
   ```bash
   npm install
   ```

### 2. วิธีการ Run Database & Backend Server (FastAPI)
เนื่องจากระบบเลือกใช้ฐานข้อมูล **SQLite** ซึ่งเป็นฐานข้อมูลรูปแบบไฟล์ (`ofi_data.db` ในโฟลเดอร์ `data/`) มันจึงทำงานแบบ **In-Process** ไปพร้อมกับเซิร์ฟเวอร์ FastAPI **คุณไม่จำเป็นต้องเปิด Service Database แยกต่างหาก** เพียงใช้คำสั่งรัน Backend ระบบจะสร้างฐานข้อมูลและตารางให้เองโดยอัตโนมัติ:

```bash
uvicorn backend.main:app --reload --port 8000
```
*ระบบจะเปิดทำงานที่: `http://localhost:8000`*

### 3. วิธีการ Run Frontend Server (Vite)
รันเซิร์ฟเวอร์ฝั่งหน้าบ้านเพื่อพัฒนาและดูผลการทำงานแบบ Realtime:

```bash
npm run dev
```
*หน้าบ้านจะเปิดทำงานที่: `http://localhost:5173` ซึ่งจะทำการคุยกับ Backend อัตโนมัติผ่านระบบ Proxy*

---

## 🔌 วิธีการเชื่อมต่อ Database, Tokens และ Paths

### 1. การเชื่อมต่อ Database (SQLite)
- **ตำแหน่งไฟล์:** `data/ofi_data.db`
- **การจัดการเชื่อมต่อ:** ดำเนินการผ่านคลาส `DatabaseManager` (อยู่ใน [database.py](file:///d:/st6959/Desktop/New%20folder/ofi-dashboard-main/backend/core/database.py)) ซึ่งจะสร้างและดึง Session การคิวรีข้อมูล
- **ตารางที่สำคัญ:**
  - `published_data` (ตารางหลักที่ซิงก์ข้อมูลดิบจาก Excel/CSV/JSON เข้าสู่ฐานข้อมูล SQLite)
  - `ofi_improvements` (ตารางโครงสร้างดั้งเดิมสำหรับรองรับข้อมูลสำรอง)

### 2. ระบบสิทธิ์และความปลอดภัยผ่าน Token (Authentication & Role tokens)
แดชบอร์ดใช้ระบบสิทธิ์แบบ Role-Based Access Control (RBAC) เพื่อกรองการมองเห็นข้อมูลผ่าน HTTP Header `Authorization` โดยฝั่งหน้าบ้านจะแนบ Token ทุกครั้งที่ร้องขอข้อมูลแดชบอร์ด:

- **รูปแบบการส่ง Header:**
  ```http
  Authorization: Bearer <token_value>
  ```
- **ประเภท Token ที่ระบบรองรับ:**
  1. `executive` (สำหรับสิทธิ์ผู้บริหาร: เห็นภาพรวมผลลัพธ์และดูรายละเอียดได้ครบทุกมิติ)
  2. `auditor` (สำหรับสิทธิ์ผู้ประเมิน: ตรวจสอบความถูกต้องและประเมินเกณฑ์คะแนนเฉลี่ย)
  3. `admin` (สำหรับสิทธิ์แอดมิน: จัดการการอัปโหลดไฟล์ และเปิด-ปิดสิทธิ์ของกราฟ)
  4. `owner:<owner-id>` (สำหรับสิทธิ์เจ้าของแผนงาน เช่น `owner:owner-pakorn` หรือ `owner:owner-nat`: **จะถูกกรองสิทธิ์ให้มองเห็นข้อมูลเฉพาะในส่วนของตนเองใน SQLite ดึงเฉพาะแถวที่ elementOwnerId ตรงกันเท่านั้น**)

### 3. API Paths และการตั้งค่า Proxy
ฝั่ง Frontend มีการคุยกับ Backend โดยเชื่อมโยงผ่านพาร์ทเหล่านี้:

- **การตั้งค่า Proxy (`vite.config.js`):**
  คำสั่งหน้าบ้านที่วิ่งไปหา `/api/*` จะถูกส่งต่อไปยังเซิร์ฟเวอร์หลังบ้าน `http://localhost:8000` โดยตรง เพื่อขจัดปัญหา CORS (Cross-Origin Resource Sharing)
- **API Paths สำคัญฝั่ง Backend:**
  - `POST /api/upload` - อัปโหลดไฟล์ข้อมูลดิบ แสตมป์เวลาในชื่อไฟล์ ป้องกันข้อมูลทับซ้อน
  - `GET /api/files` - เรียกดูรายการไฟล์ชุดข้อมูลทั้งหมดในคลัง
  - `DELETE /api/files/{filename}` - ลบไฟล์ชุดข้อมูลและปรับปรุงภาพรวม
  - `POST /api/files/toggle` - สลับสถานะ เปิด/ปิด การใช้งานไฟล์ข้อมูล
  - `GET /api/dashboard-data` - ดึงสถิติและข้อมูล OFI ทั้งหมดแบบ Role-filtered (ต้องระบุ Token สิทธิ์)
  - `GET /api/chart-settings` - ดึงค่าการเปิด-ปิดการแสดงผลของกราฟแต่ละตัว
  - `POST /api/chart-settings` - บันทึกค่าการกำหนดสิทธิ์การแสดงกราฟ
  - `POST /api/export-pdf/{role}` และ `POST /api/export-jpg/{role}` - สั่งบันทึกภาพหน้าจอแดชบอร์ดตามสิทธิ์จริงเพื่อแปลงเป็นรายงาน

---

## 📊 วิธีการจัดการ (CRUD) กราฟต่างๆ

ระบบมีความยืดหยุ่นในการจัดการกราฟผ่านส่วนประสานงานผู้ดูแลระบบ (Admin Dashboard) และตัวเรนเดอร์อัจฉริยะ:

### 1. วิธีเพิ่ม/แก้ไข/ลบตัวเลือกการแสดงกราฟ (CRUD ด้านสิทธิ์)
ความเคลื่อนไหวของกราฟแดชบอร์ดจะถูกบันทึกไว้ใน [chart_settings.json](file:///d:/st6959/Desktop/New%20folder/ofi-dashboard-main/data/chart_settings.json) ในรูปแบบ JSON Object:

```json
"chart-yearly-comparison": {
    "title": "2.1 เปรียบเทียบคะแนนภาพรวมรายปี",
    "roles": ["executive", "auditor", "owner"]
}
```

* **การสร้างหรือเพิ่มกราฟ (Create/Update):** ผู้ดูแลระบบสามารถติ๊กเลือกสิทธิ์ในหน้าจอแอดมิน เพื่อส่ง `POST /api/chart-settings` เพื่อแก้ไขอาเรย์ `roles` ว่าบทบาทใดบ้างที่จะมีสิทธิ์มองเห็นกราฟตัวนั้นๆ
* **การลบกราฟออกจากการแสดงผล (Delete):** สามารถนำบทบาทออก หรือเอา Key ของกราฟนั้นๆ ออกจาก `chart_settings.json` หรือสามารถลบ Canvas ออกจากหน้า HTML สิทธิ์กราฟก็จะหมดไปเอง

### 2. วิธีเขียนตัวเรนเดอร์กราฟฝั่งหน้าบ้าน
กราฟต่างๆ ถูกวาดโดยใช้ไลบารี่ **Chart.js** ซึ่งรวมศูนย์ฟังก์ชันกราฟไว้ในไฟล์ [chartRenderers.js](file:///d:/st6959/Desktop/New%20folder/ofi-dashboard-main/frontend/js/utils/chartRenderers.js) ซึ่งจะมีฟังก์ชันแยกตามประเภทของภาพข้อมูล เช่น:
- `renderYearlyComparisonChart(...)` (เปรียบเทียบคะแนนรายปี - Bar Chart)
- `renderOfiLevelChart(...)` (ความยาก OFI Level - Doughnut Chart)
- `render6YearTrendChart(...)` (แนวโน้ม 6 ปี - Line Chart)
- `renderIndividualWorkloadChart(...)` (งานสะสมรายบุคคล - Stacked Bar Chart)
- `renderHorizontalBarChart(...)` (ปัญหาพบบ่อย - Horizontal Bar Chart)
- `renderGanttGrid(...)` (Gantt ติดตามสถานะเฟสงาน)

### 3. กลไกการเรนเดอร์แบบ Dynamic (Dynamic Rendering Pipeline)
1. เมื่อผู้ใช้ล็อกอิน สคริปต์ `app.js` หรือหน้าบทบาทเฉพาะ (เช่น `executive_app.js`) จะยิงคำขอไปที่ `GET /api/chart-settings` และ `GET /api/dashboard-data`
2. ระบบจะตรวจสอบว่าสิทธิ์ของผู้ใช้คนนี้ (Role) ตรงตามที่ได้รับอนุญาตใน `roles` ของกราฟแต่ละตัวหรือไม่ผ่านฟังก์ชัน `canShow(chartId)`
3. หากมีสิทธิ์ ระบบจะสร้าง Canvas เปล่าขึ้นมาและส่งผ่านข้อมูลชุดที่ผ่านการกรองแล้วไปยังฟังก์ชันของ [chartRenderers.js](file:///d:/st6959/Desktop/New%20folder/ofi-dashboard-main/frontend/js/utils/chartRenderers.js) เพื่อวาดกราฟออกมาอย่างสมบูรณ์แบบ
