import os
import json
from typing import Dict, Any, List, Optional
from backend.core.config import settings

class SettingsRepository:
    def __init__(self, data_folder: str = settings.DATA_FOLDER):
        self.data_folder = data_folder
        self.config_path = os.path.join(self.data_folder, "system_config.json")
        self.chart_settings_path = os.path.join(self.data_folder, "chart_settings.json")
        self.status_file_path = os.path.join(self.data_folder, "file_status.json")
        self.metadata_file_path = os.path.join(self.data_folder, "file_metadata.json")
        self.master_metadata_path = os.path.join(self.data_folder, "master_metadata.json")

    def get_system_config(self) -> Dict[str, Any]:
        """Load system configuration from JSON."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[SettingsRepository] Error loading config: {e}")
        return {"auto_update": False, "last_sync": None}

    def save_system_config(self, config: Dict[str, Any]) -> None:
        """Save system configuration to JSON."""
        os.makedirs(self.data_folder, exist_ok=True)
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False)

    def get_chart_settings(self) -> Dict[str, Any]:
        """Load chart visualization configurations."""
        if os.path.exists(self.chart_settings_path):
            try:
                with open(self.chart_settings_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[SettingsRepository] Error loading chart settings: {e}")
        return {}

    def save_chart_settings(self, chart_settings: Dict[str, Any]) -> None:
        """Save chart visualization configurations."""
        os.makedirs(self.data_folder, exist_ok=True)
        with open(self.chart_settings_path, "w", encoding="utf-8") as f:
            json.dump(chart_settings, f, ensure_ascii=False, indent=4)

    def get_file_status(self) -> Dict[str, Any]:
        """Load active file configurations."""
        if os.path.exists(self.status_file_path):
            try:
                with open(self.status_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[SettingsRepository] Error loading file status: {e}")
        return {}

    def save_file_status(self, status_data: Dict[str, Any]) -> None:
        """Save active file configurations."""
        os.makedirs(self.data_folder, exist_ok=True)
        with open(self.status_file_path, "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False)

    def get_file_metadata(self) -> Dict[str, Any]:
        """Load file upload metadata history."""
        if os.path.exists(self.metadata_file_path):
            try:
                with open(self.metadata_file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[SettingsRepository] Error loading metadata: {e}")
        return {}

    def save_file_metadata(self, metadata: Dict[str, Any]) -> None:
        """Save file upload metadata history."""
        os.makedirs(self.data_folder, exist_ok=True)
        with open(self.metadata_file_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False)

    def get_master_metadata(self) -> Dict[str, Any]:
        """Load reference metadata and topic scoring standards."""
        if os.path.exists(self.master_metadata_path):
            try:
                with open(self.master_metadata_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                print(f"[SettingsRepository] Error loading master metadata: {e}")
        return {}

    def save_master_metadata(self, metadata: Dict[str, Any]) -> None:
        """Save reference metadata and topic scoring standards."""
        os.makedirs(self.data_folder, exist_ok=True)
        with open(self.master_metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False)

    def load_base_structure(self) -> Dict[str, Any]:
        """Load static structure baseline from sample-data.js or data.json."""
        try:
            with open("sample-data.js", "r", encoding="utf-8") as f:
                content = f.read().replace("window.OFI_SAMPLE_DATA =", "").replace("window.DATA =", "").strip().rstrip(';')
                return json.loads(content)
        except FileNotFoundError:
            try:
                fallback_path = os.path.join(self.data_folder, "data.json")
                with open(fallback_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                    # Fix garbled names in elementOwners if present
                    fixed_names = {
                        "owner-pakorn": "นายภากร สุริยาภิวัฒน์",
                        "owner-nat": "นางสาวณัฐิดา จันทร์สว่าง",
                        "owner-somchai": "นายสมชาย วิวัฒนศักดิ์",
                        "owner-siriporn": "นางศิริพร แสนอรุณ"
                    }
                    if "reference" in data and "elementOwners" in data["reference"]:
                        for owner in data["reference"]["elementOwners"]:
                            oid = owner.get("id")
                            if oid in fixed_names:
                                owner["nameThai"] = fixed_names[oid]
                                
                    return data
            except FileNotFoundError:
                return {"reference": {"elementOwners": [], "departments": []}, "ofiImprovements": []}

settings_repository = SettingsRepository()
