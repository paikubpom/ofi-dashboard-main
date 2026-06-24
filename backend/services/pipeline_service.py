import os
import json
import sqlite3
import datetime
import pandas as pd
from typing import Dict, Any, List, Tuple
from backend.core.config import settings
from backend.core.database import db_manager, DatabaseManager
from backend.repositories.settings_repository import settings_repository, SettingsRepository

class DataPipelineService:
    REQUIRED_COLUMNS = {"ofiTitle", "elementOwnerId", "ofiStatus"}
    SYSTEM_FILES = {
        "file_status.json", "file_metadata.json", "published_data.json", 
        "system_config.json", "ofi_data.db", "ofi_database.db", 
        "master_metadata.json", "chart_settings.json"
    }

    def __init__(
        self, 
        settings_repo: SettingsRepository = settings_repository,
        db: DatabaseManager = db_manager
    ):
        self.settings_repo = settings_repo
        self.db = db
        self.data_folder = self.settings_repo.data_folder

    def validate_file_schema(self, file_path: str) -> Tuple[bool, str]:
        """Verify the headers of the uploaded file (read first row to save RAM)."""
        try:
            if file_path.endswith(('.xlsx', '.xls')):
                xls = pd.ExcelFile(file_path)
                import re
                selected_sheet = None
                for sheet in xls.sheet_names:
                    if re.search(r"OFI Improvement Plan", sheet, re.IGNORECASE):
                        selected_sheet = sheet
                        break
                if not selected_sheet:
                    return False, "ไม่พบชีตที่ตรงตามเงื่อนไข (ต้องการชีตที่มีคำว่า 'OFI Improvement Plan')"
                df_header = pd.read_excel(file_path, sheet_name=selected_sheet, nrows=0)
            elif file_path.endswith('.csv'):
                df_header = pd.read_csv(file_path, nrows=0)
            else:
                return True, "ไฟล์ประเภทนี้ไม่ต้องตรวจสอบโครงสร้าง"

            file_columns = set(df_header.columns)
            missing_columns = self.REQUIRED_COLUMNS - file_columns

            if missing_columns:
                return False, f"โครงสร้างไฟล์ไม่ถูกต้อง ขาดคอลัมน์สำคัญ: {', '.join(missing_columns)}"
            return True, "โครงสร้างไฟล์ถูกต้อง"
        except Exception as e:
            return False, f"ไม่สามารถอ่านโครงสร้างไฟล์ได้เนื่องจาก: {str(e)}"

    def clean_header_row(self, df: pd.DataFrame) -> pd.DataFrame:
        """If the first row looks like a header, promote it to headers and clean the dataframe."""
        if df is not None and not df.empty:
            first_row_vals = [str(x).lower().strip() for x in df.iloc[0].values if x is not None]
            header_keywords = {'topic', 'ofi', 'sub-topic', 'subtopic', 'owner', 'status', 'score'}
            is_header_row = any(any(kw in val for kw in header_keywords) for val in first_row_vals)
            
            if is_header_row:
                print("[Data Pipeline] Detected header row at first index. Cleaning and setting headers.")
                new_cols = []
                for i, x in enumerate(df.iloc[0]):
                    if x is not None and str(x).strip() != "":
                        new_cols.append(str(x).strip())
                    else:
                        new_cols.append(df.columns[i] if i < len(df.columns) else f"Col_{i}")
                df.columns = new_cols
                df = df.iloc[1:].reset_index(drop=True)
        return df

    def normalize_dataframe(self, df: pd.DataFrame, inferred_module: str) -> List[Dict[str, Any]]:
        """Normalize dataframe columns and values to standard schema."""
        normalized_cols = {}
        for col in df.columns:
            c_clean = str(col).lower().replace('\n', ' ').strip()
            
            # Check if it's a phase column first to avoid mis-mapping it
            is_phase = (
                'process owner' in c_clean or 'พ.ค.' in c_clean or 'มิ.ย.' in c_clean or 'po' in c_clean or
                'eo' in c_clean or 'ec' in c_clean or 'ก.ค.' in c_clean or 'ส.ค.' in c_clean or
                'assessment' in c_clean or 'assess' in c_clean or 'ก.ย.' in c_clean or 'ต.ค.' in c_clean or
                'นอกระบบ' in c_clean or 'ออกระบบ' in c_clean or 'document' in c_clean or 'พ.ย.' in c_clean or
                'site visit' in c_clean or 'visit' in c_clean or 'site' in c_clean or 'ธ.ค.' in c_clean or
                'แผนปรับปรุง' in c_clean or 'รายงาน' in c_clean or 'เอกสาร' in c_clean
            )
            
            if is_phase:
                continue
                
            if 'sub-topic' in c_clean or 'subtopic' in c_clean:
                normalized_cols[col] = 'topicName'
            elif 'topic' in c_clean:
                normalized_cols[col] = 'moduleName'
            elif 'year' in c_clean or 'ปี' in c_clean:
                normalized_cols[col] = 'assessmentYear'
            elif 'owner' in c_clean or 'ผู้ดูแล' in c_clean:
                normalized_cols[col] = 'elementOwnerId'
            elif 'level' in c_clean:
                normalized_cols[col] = 'ofiLevel'
            elif 'issue' in c_clean:
                normalized_cols[col] = 'issueTags'
            elif 'source' in c_clean or 'แหล่งที่มา' in c_clean or '觷' in c_clean:
                normalized_cols[col] = 'defectSource'
            elif 'score' in c_clean or 'คะแนน' in c_clean or 'ṹ' in c_clean or 'ʤ' in c_clean:
                normalized_cols[col] = 'score'
            elif 'status' in c_clean or 'สถานะ' in c_clean or 'ἹûѺ' in c_clean:
                normalized_cols[col] = 'overallStatus'
            elif col == 'OFI':
                normalized_cols[col] = 'ofiTitle'
                
        df = df.rename(columns={k: v for k, v in normalized_cols.items() if v not in df.columns})
        
        # Ensure mandatory fields are present
        if 'ofiTitle' not in df.columns:
            if 'OFI' in df.columns:
                df['ofiTitle'] = df['OFI']
            else:
                for col in df.columns:
                    if 'ofi' in str(col).lower() and col not in ['ofiLevel', 'overallStatus', 'ofiStatus']:
                        df['ofiTitle'] = df[col]
                        break
                if 'ofiTitle' not in df.columns:
                    df['ofiTitle'] = "ไม่ระบุหัวข้อ (N/A)"
                    
        if 'elementOwnerId' not in df.columns:
            df['elementOwnerId'] = "ไม่ระบุ Owner"
            
        if 'ofiLevel' not in df.columns:
            df['ofiLevel'] = "N/A"

        # Identify phase columns
        standard_keys = {
            'score', 'elementOwnerId', 'assessmentYear', 'ofiLevel', 'ofiTitle', 
            'defectSource', 'issueTags', 'topicName', 'moduleName', 'id', 'overallStatus', 'ofiStatus'
        }
        phase_cols = {
            'phase-plan': [c for c in df.columns if c not in standard_keys and ('process owner' in str(c).lower() or ' owner' in str(c).lower() or 'PO' in str(c))],
            'phase-eo-ec': [c for c in df.columns if c not in standard_keys and ('eo' in str(c).lower() or 'score' in str(c).lower() or 'ec' in str(c).lower())],
            'phase-assessment': [c for c in df.columns if c not in standard_keys and ('assessment' in str(c).lower() or 'assess' in str(c).lower())],
            'phase-document': [c for c in df.columns if c not in standard_keys and ('นอกระบบ' in str(c) or 'ออกระบบ' in str(c) or 'document' in str(c).lower() or 'เอกสาร' in str(c))],
            'phase-site-visit': [c for c in df.columns if c not in standard_keys and ('site visit' in str(c).lower() or 'visit' in str(c).lower() or 'site' in str(c).lower())]
        }
        
        records = []
        for _, row in df.iterrows():
            rec = row.to_dict()
            
            # Skip template examples or empty rows
            owner_val = str(rec.get('elementOwnerId') or '').strip()
            ofi_val = str(rec.get('ofiTitle') or '').strip()
            
            if not ofi_val or ofi_val.lower() in ('nan', 'none', '') or ofi_val.lower() == 'ofi':
                continue
                
            if 'ชื่อและรูป' in owner_val or 'ผู้บริหาร' in owner_val or 'รูปภาพ' in owner_val or 'ชื่อและรูป' in ofi_val or 'ผู้บริหาร' in ofi_val:
                print(f"[Data Pipeline] Skipped guide row: Owner='{owner_val}', OFI='{ofi_val[:30]}...'")
                continue
                
            # Clean null values
            for k, v in rec.items():
                if pd.isnull(v):
                    rec[k] = None
            
            # Build phases object
            phases = {}
            for phase_name, cols in phase_cols.items():
                if cols:
                    val = rec.get(cols[0])
                    if val is not None and str(val).strip() != "":
                        val_str = str(val).strip().lower()
                        if 'done' in val_str or 'เสร็จ' in val_str or 'สำเร็จ' in val_str:
                            status = 'Done'
                        elif 'qualified' in val_str or 'ผ่าน' in val_str:
                            status = 'Qualified'
                        elif 'in progress' in val_str or 'ดำเนิน' in val_str:
                            status = 'In progress'
                        elif 'delay' in val_str or 'ช้า' in val_str:
                            status = 'Delayed'
                        else:
                            status = str(val).strip()
                        phases[phase_name] = {"status": status}
                    else:
                        phases[phase_name] = {"status": "Not started"}
                else:
                    phases[phase_name] = {"status": "Not started"}
            
            rec['phases'] = phases
            
            if 'overallStatus' not in rec or rec['overallStatus'] is None:
                active_statuses = [
                    phases[p]['status'] for p in ['phase-site-visit', 'phase-document', 'phase-assessment', 'phase-eo-ec', 'phase-plan'] 
                    if phases[p]['status'] not in ['Not started', '']
                ]
                rec['overallStatus'] = active_statuses[0] if active_statuses else 'Not started'
                
            rec['ofiStatus'] = rec['overallStatus']
            rec['moduleName'] = inferred_module
            rec['module'] = inferred_module
            
            if 'issueTags' in rec and rec['issueTags']:
                tags_val = rec['issueTags']
                if isinstance(tags_val, str):
                    rec['issueTags'] = [t.strip() for t in tags_val.replace(',', ' ').split() if t.strip()]
            else:
                rec['issueTags'] = []
                
            if 'id' not in rec or not rec['id']:
                if 'Plan No.' in rec and rec['Plan No.'] is not None:
                    rec['id'] = f"ofi-{inferred_module.lower()}-{int(float(rec['Plan No.'])):03d}"
                elif 'Plan No' in rec and rec['Plan No'] is not None:
                    rec['id'] = f"ofi-{inferred_module.lower()}-{int(float(rec['Plan No'])):03d}"
                else:
                    rec['id'] = f"ofi-{inferred_module.lower()}-{len(records)+1:03d}"
                    
            records.append(rec)
            
        return records

    def load_and_merge_all_files(self) -> Dict[str, Any]:
        """Scan all files in data folder, merge active file data, write to SQLite."""
        base_data = self.settings_repo.load_base_structure()
        all_combined_ofis = []

        if not os.path.exists(self.data_folder):
            os.makedirs(self.data_folder, exist_ok=True)
            return base_data

        status_data = self.settings_repo.get_file_status()
        active_files = [
            fname for fname, f_conf in status_data.items()
            if (f_conf.get("isActive", False) if isinstance(f_conf, dict) else bool(f_conf))
        ]

        for file_name in os.listdir(self.data_folder):
            if file_name not in active_files or file_name in self.SYSTEM_FILES:
                continue
                
            file_path = os.path.join(self.data_folder, file_name)
            
            # Excel
            if file_name.endswith((".xlsx", ".xls")):
                try:
                    xls = pd.ExcelFile(file_path)
                    sheet_names = xls.sheet_names
                    
                    import re
                    selected_sheet = None
                    for sheet in sheet_names:
                        if re.search(r"OFI Improvement Plan", sheet, re.IGNORECASE):
                            selected_sheet = sheet
                            break
                    
                    if not selected_sheet:
                        print(f"[Excel Loader] Skipping file '{file_name}' as it lacks a sheet matching regex 'OFI Improvement Plan'")
                        continue
                    
                    print(f"[Excel Loader] Loading sheet '{selected_sheet}' from file '{file_name}'")
                    df = pd.read_excel(file_path, sheet_name=selected_sheet)
                    df = self.clean_header_row(df)
                    df = df.where(pd.notnull(df), None)
                    
                    inferred_module = "RM&IC"
                    for mod_code in ['CG&LD', 'SP', 'RM&IC', 'SM', 'CM', 'DT', 'HCM', 'KM', 'IM', 'IA']:
                        target = mod_code.lower()
                        if target in selected_sheet.lower() or target in file_name.lower():
                            if target == 'im':
                                sh_clean = selected_sheet.lower().replace('improvement', '')
                                fn_clean = file_name.lower().replace('improvement', '')
                                if 'im' not in sh_clean and 'im' not in fn_clean:
                                    continue
                            inferred_module = mod_code
                            break
                    
                    records = self.normalize_dataframe(df, inferred_module)
                    for r in records: 
                        r["_source_file"] = file_name
                    all_combined_ofis.extend(records)
                except Exception as e: 
                    print(f"[Error] Failed reading Excel {file_name}: {e}")
                    
            # CSV
            elif file_name.endswith(".csv"):
                try:
                    try: 
                        df = pd.read_csv(file_path, encoding="utf-8")
                    except UnicodeDecodeError: 
                        df = pd.read_csv(file_path, encoding="cp874")
                    df = self.clean_header_row(df)
                    df = df.where(pd.notnull(df), None)
                    records = df.to_dict(orient="records")
                    for r in records: 
                        r["_source_file"] = file_name
                    all_combined_ofis.extend(records)
                except Exception as e: 
                    print(f"[Error] Failed reading CSV {file_name}: {e}")

            # JSON
            elif file_name.endswith(".json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        json_content = json.load(f)
                        if isinstance(json_content, list):
                            for r in json_content: 
                                r["_source_file"] = file_name
                            all_combined_ofis.extend(json_content)
                        elif isinstance(json_content, dict):
                            if "ofiImprovements" in json_content:
                                for r in json_content["ofiImprovements"]: 
                                    r["_source_file"] = file_name
                                all_combined_ofis.extend(json_content["ofiImprovements"])
                            if "reference" in json_content: 
                                base_data["reference"] = json_content["reference"]
                            if "topicScoreMaster" in json_content: 
                                base_data["topicScoreMaster"] = json_content["topicScoreMaster"]
                except Exception as e: 
                    print(f"[Error] Failed reading JSON {file_name}: {e}")

            # JavaScript
            elif file_name.endswith(".js"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        js_content = f.read().strip()
                        json_part = js_content.split("=", 1)[1].strip() if "=" in js_content else js_content
                        if json_part.endswith(";"): 
                            json_part = json_part[:-1].strip()
                        js_data = json.loads(json_part)
                        
                        if isinstance(js_data, list):
                            for r in js_data: 
                                r["_source_file"] = file_name
                            all_combined_ofis.extend(js_data)
                        elif isinstance(js_data, dict):
                            if "ofiImprovements" in js_data:
                                for r in js_data["ofiImprovements"]: 
                                    r["_source_file"] = file_name
                                all_combined_ofis.extend(js_data["ofiImprovements"])
                            if "reference" in js_data: 
                                base_data["reference"] = js_data["reference"]
                            if "topicScoreMaster" in js_data: 
                                base_data["topicScoreMaster"] = js_data["topicScoreMaster"]
                except Exception as e: 
                    print(f"[Error] Failed reading JS {file_name}: {e}")

        # Sync to SQLite
        conn = self.db.get_connection()
        try:
            if all_combined_ofis:
                final_df = pd.DataFrame(all_combined_ofis)
                
                # Convert list/dict columns to json string before saving to sqlite
                for col in final_df.columns:
                    if final_df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                        print(f"[SQLite Pipeline] Serializing object column '{col}' to JSON string...")
                        final_df[col] = final_df[col].apply(
                            lambda x: json.dumps(x, ensure_ascii=False) if isinstance(x, (dict, list)) else x
                        )
                
                final_df.to_sql("published_data", conn, if_exists="replace", index=False)
                print(f"[SQLite Pipeline] Saved {len(all_combined_ofis)} records to 'published_data'")
            else:
                cursor = conn.cursor()
                cursor.execute("DROP TABLE IF EXISTS published_data")
                conn.commit()
        except Exception as db_err:
            print(f"[SQLite Pipeline Error]: {db_err}")
        finally:
            conn.close()

        # Save to master metadata config
        try:
            master_metadata = {
                "reference": base_data.get("reference", {}),
                "topicScoreMaster": base_data.get("topicScoreMaster", {})
            }
            self.settings_repo.save_master_metadata(master_metadata)
            print("[Data Pipeline] Updated master metadata config.")
        except Exception as meta_err:
            print(f"[Data Pipeline Error] Failed to update master metadata: {meta_err}")

        base_data["ofiImprovements"] = all_combined_ofis
        if "reference" not in base_data:
            base_data["reference"] = {"elementOwners": [], "departments": []}
            
        return base_data

    def sync_dashboard_data(self) -> float:
        """Run standard pipeline and write final published JSON snapshot."""
        db_data = self.load_and_merge_all_files()
        published_json_path = os.path.join(self.data_folder, "published_data.json")
        
        with open(published_json_path, "w", encoding="utf-8") as f:
            json.dump(db_data, f, ensure_ascii=False)
        
        config = self.settings_repo.get_system_config()
        now = datetime.datetime.now().timestamp()
        config["last_sync"] = now
        self.settings_repo.save_system_config(config)
        return now

pipeline_service = DataPipelineService()
