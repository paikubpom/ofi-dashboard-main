from fastapi import APIRouter, Request
from typing import Dict, Any

from backend.repositories.settings_repository import settings_repository
from backend.services.pipeline_service import pipeline_service
from backend.services.pdf_export_service import pdf_export_service
from backend.models.schemas import SyncResponse, AutoUpdateSetting, GenericResponse

router = APIRouter()

@router.post("/sync", response_model=SyncResponse)
def force_sync():
    """Forces immediate synchronization of all dataset files and updates SQLite DB."""
    last_sync = pipeline_service.sync_dashboard_data()
    pdf_export_service.clear_cache()
    return SyncResponse(status="success", last_sync=last_sync)

@router.get("/settings")
def get_settings():
    """Returns general system configurations."""
    return settings_repository.get_system_config()

@router.post("/settings/auto-update", response_model=GenericResponse)
def toggle_auto_update(setting: AutoUpdateSetting):
    """Enables or disables automatic data synchronization upon uploads."""
    config = settings_repository.get_system_config()
    config["auto_update"] = setting.auto_update
    settings_repository.save_system_config(config)
    
    if setting.auto_update:
        pipeline_service.sync_dashboard_data()
        
    return GenericResponse(status="success", message="Auto-update setting updated.")

@router.get("/chart-settings")
def get_chart_settings():
    """Gets visibility permissions for all dashboard charts."""
    return settings_repository.get_chart_settings()

@router.post("/chart-settings", response_model=GenericResponse)
async def save_chart_settings(request: Request):
    """Saves updated visibility configurations for dashboard charts."""
    settings_data = await request.json()
    settings_repository.save_chart_settings(settings_data)
    return GenericResponse(status="success", message="บันทึกสิทธิ์การแสดงผลกราฟเรียบร้อย")
