import os
import shutil
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any

from backend.core.config import settings
from backend.repositories.settings_repository import settings_repository
from backend.services.pipeline_service import pipeline_service
from backend.services.pdf_export_service import pdf_export_service
from backend.models.schemas import FileListResponse, GenericResponse

router = APIRouter()

@router.post("/upload", response_model=GenericResponse)
async def upload_data_file(file: UploadFile = File(...)):
    """Receives an uploaded dataset file, stamps it with a timestamp, and syncs/merges data."""
    try:
        os.makedirs(settings.DATA_FOLDER, exist_ok=True)
        
        # Add timestamp to filename to prevent overwrite conflicts
        filename, extension = os.path.splitext(file.filename)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        new_filename = f"{filename}_{timestamp}{extension}"
        file_location = os.path.join(settings.DATA_FOLDER, new_filename)
        
        with open(file_location, "wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Log timestamp metadata
        metadata = settings_repository.get_file_metadata()
        metadata[new_filename] = {"upload_time": datetime.datetime.now().timestamp()}
        settings_repository.save_file_metadata(metadata)
            
        config = settings_repository.get_system_config()
        if config.get("auto_update", False):
            pipeline_service.sync_dashboard_data()
        else:
            pipeline_service.load_and_merge_all_files()
            
        return GenericResponse(
            status="success", 
            message=f"อัปโหลดและตรวจสอบไฟล์ '{new_filename}' เรียบร้อย!"
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files", response_model=FileListResponse)
async def list_files():
    """Lists files in the data directory along with their status and upload times."""
    files = []
    status_data = settings_repository.get_file_status()
    metadata_data = settings_repository.get_file_metadata()
    metadata_changed = False
    
    # Exclude system configs and DB files from listings
    SYSTEM_FILES = pipeline_service.SYSTEM_FILES

    if os.path.exists(settings.DATA_FOLDER):
        for f in os.listdir(settings.DATA_FOLDER):
            if f in SYSTEM_FILES or not os.path.isfile(os.path.join(settings.DATA_FOLDER, f)):
                continue
                
            path = os.path.join(settings.DATA_FOLDER, f)
            stats = os.stat(path)
            
            if f not in metadata_data:
                metadata_data[f] = {"upload_time": stats.st_mtime}
                metadata_changed = True
            
            import_time = metadata_data[f]["upload_time"]
            file_config = status_data.get(f, False)
            if isinstance(file_config, dict):
                is_active = bool(file_config.get("isActive", False))
            else:
                is_active = bool(file_config)                
            
            files.append({
                "name": f,
                "created": import_time,
                "modified": stats.st_mtime,
                "isActive": is_active
            })

    if metadata_changed:
        settings_repository.save_file_metadata(metadata_data)
        
    return FileListResponse(files=files)

@router.delete("/files/{filename}", response_model=GenericResponse)
async def delete_data_file(filename: str):
    """Deletes a file from the dataset repository."""
    file_path = os.path.join(settings.DATA_FOLDER, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        
        # Remove from upload metadata
        metadata = settings_repository.get_file_metadata()
        if filename in metadata:
            del metadata[filename]
            settings_repository.save_file_metadata(metadata)

        config = settings_repository.get_system_config()
        if config.get("auto_update", False):
            pipeline_service.sync_dashboard_data()
        else:
            pipeline_service.load_and_merge_all_files()
            
        pdf_export_service.clear_cache()
        return GenericResponse(status="success", message=f"ลบไฟล์ {filename} สำเร็จ")
    raise HTTPException(status_code=404, detail="ไม่พบไฟล์ที่ต้องการลบ")

@router.post("/files/toggle")
async def toggle_file_status(filename: str):
    """Toggles active/inactive status of a file in the data pipeline."""
    status_data = settings_repository.get_file_status()
        
    current_config = status_data.get(filename, False)
    if isinstance(current_config, dict):
        current_config["isActive"] = not current_config.get("isActive", False)
        status_data[filename] = current_config
    else:
        status_data[filename] = {"isActive": not bool(current_config), "visibleTo": "all"}
    
    settings_repository.save_file_status(status_data)
    
    config = settings_repository.get_system_config()
    if config.get("auto_update", False):
        pipeline_service.sync_dashboard_data()
        
    pdf_export_service.clear_cache()
    return {"status": "success", "active_files": status_data}
