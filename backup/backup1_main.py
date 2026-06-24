import os
import json
import pandas as pd
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OFI Integration API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. โหลดข้อมูลอ้างอิงโครงสร้างหลักจาก sample-data.js เหมือนเดิม
def load_base_structure():
    with open("sample-data.js", "r", encoding="utf-8") as f:
        content = f.read().replace("window.OFI_SAMPLE_DATA =", "").strip().rstrip(';')
        return json.loads(content)

# 2. 🚀 ฟังก์ชันหัวใจสำคัญ: สแกนโฟลเดอร์และรวมข้อมูลจากทุกไฟล์พร้อมกัน
def load_and_merge_all_files():
    # ดึงโครงสร้างหลัก (เช่น รายชื่อหน่วยงาน และรายชื่อ Owner) มาตั้งต้นไว้ก่อน
    base_data = load_base_structure()
    
    #สร้าง List ว่างเพื่อรอรับข้อมูล OFI จากทุกไฟล์มารวมกัน
    all_combined_ofis = []
    
    # ระบุโฟลเดอร์เป้าหมาย
    target_folder = "./data"
    
    # ตรวจสอบว่ามีโฟลเดอร์นี้อยู่ไหม ถ้าไม่มีให้สร้างขึ้นมากันโค้ดพัง
    if not os.path.exists(target_folder):
        os.makedirs(target_folder)
        return base_data

    # 🔄 ลูปสแกนทุกไฟล์ที่อยู่ในโฟลเดอร์ data/
    for file_name in os.listdir(target_folder):
        file_path = os.path.join(target_folder, file_name)
        
        # 🟢 เคสที่ 1: เจอไฟล์ Excel (.xlsx)
        if file_name.endswith(".xlsx") or file_name.endswith(".xls"):
            try:
                df = pd.read_excel(file_path)
                df = df.where(pd.notnull(df), None) # แปลงค่าว่างใน Excel เป็น None (null ใน JSON)
                records = df.to_dict(orient="records")
                
                # ใช้ .extend() เพื่อเอาสมาชิกใน List จาก Excel ไปต่อท้าย List หลัก
                all_combined_ofis.extend(records)
                print(f"✅ รวมข้อมูลจาก Excel สำเร็จ: {file_name} ({len(records)} รายการ)")
            except Exception as e:
                print(f"❌ อ่านไฟล์ Excel พัง {file_name}: {e}")
                
        # 🔵 เคสที่ 2: เจอไฟล์ JSON (.json)
        elif file_name.endswith(".json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    json_content = json.load(f)
                    
                    # ตรวจสอบโครงสร้าง JSON ว่าเป็น List หรือเป็น Dict
                    if isinstance(json_content, list):
                        all_combined_ofis.extend(json_content)
                    elif isinstance(json_content, dict) and "ofiImprovements" in json_content:
                        all_combined_ofis.extend(json_content["ofiImprovements"])
                        
                print(f"✅ รวมข้อมูลจาก JSON สำเร็จ: {file_name}")
            except Exception as e:
                print(f"❌ อ่านไฟล์ JSON พัง {file_name}: {e}")

        # 🟡 เคสที่ 3: เจอไฟล์ JavaScript (.js) 🌟 (เพิ่มเข้ามาใหม่)
        elif file_name.endswith(".js"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    js_content = f.read().strip()
                    
                    # ตัดคำสั่งประกาศตัวแปรออก (แยกด้วยเครื่องหมาย = เอาเฉพาะฝั่งขวา)
                    if "=" in js_content:
                        json_part = js_content.split("=", 1)[1].strip()
                    else:
                        json_part = js_content
                    
                    # ตัดเซมิโคลอนปิดท้ายออก (ถ้ามี)
                    if json_part.endswith(";"):
                        json_part = json_part[:-1].strip()
                    
                    # แปลงข้อความเป็น JSON วัตถุ
                    js_data = json.loads(json_part)
                    
                    # ตรวจสอบและดึงข้อมูลลง List หลัก
                    if isinstance(js_data, list):
                        all_combined_ofis.extend(js_data)
                    elif isinstance(js_data, dict) and "ofiImprovements" in js_data:
                        all_combined_ofis.extend(js_data["ofiImprovements"])
                        
                print(f"✅ รวมข้อมูลจาก JS สำเร็จ: {file_name}")
            except Exception as e:
                print(f"❌ อ่านไฟล์ JS พัง {file_name}: {e}")

    # นำข้อมูล OFI ทั้งหมดที่รวมร่างเสร็จแล้ว ยัดกลับเข้าไปในโครงสร้างหลัก
    base_data["ofiImprovements"] = all_combined_ofis
    return base_data

# 3. ENDPOINTS API ทำงานร่วมกับข้อมูลที่รวมแล้ว
@app.get("/api/owners")
def get_owners():
    db = load_and_merge_all_files()
    return {"status": "success", "data": db["reference"]["elementOwners"]}

@app.get("/api/dashboard-data")
def get_secure_dashboard_data(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split(" ")[1]
    
    # เรียกฟังก์ชันสแกนและรวมไฟล์แบบ Real-time ทุกครั้งที่มีการเรียก API
    db = load_and_merge_all_files()
    all_ofis = db.get("ofiImprovements", [])
    secured_ofis = []

    # ทำ Row-Level Security (RLS) เพื่อคัดกรองสิทธิ์ต่อ
    if token == "executive" or token == "auditor":
        secured_ofis = all_ofis
    elif token.startswith("owner:"):
        owner_id = token.split(":")[1]
        secured_ofis = [o for o in all_ofis if str(o.get("elementOwnerId")) == owner_id]
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    db["ofiImprovements"] = secured_ofis
    return {
        "status": "success",
        "role": token.split(":")[0],
        "total_records_sent": len(secured_ofis),
        "data": db
    }