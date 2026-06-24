import json
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Tuple, Optional

from backend.api.deps import get_current_role
from backend.repositories.ofi_repository import OFIRepository
from backend.repositories.settings_repository import settings_repository
from backend.models.schemas import ActiveOwnersResponse, OwnersListResponse

router = APIRouter()
ofi_repo = OFIRepository()

@router.get("/dashboard-data")
async def get_secure_dashboard_data(current_role_info: Tuple[str, Optional[str]] = Depends(get_current_role)):
    """Retrieves secured dashboard statistics, metadata, and OFI items according to user roles."""
    role_type, owner_id = current_role_info
    
    status_data = settings_repository.get_file_status()
    allowed_files = []
    
    for fname, f_conf in status_data.items():
        is_act = f_conf.get("isActive", False) if isinstance(f_conf, dict) else bool(f_conf)
        if is_act:
            visible_to = f_conf.get("visibleTo", "all") if isinstance(f_conf, dict) else "all"
            if (visible_to == "all" or visible_to == role_type or (owner_id and visible_to == f"owner:{owner_id}")):
                allowed_files.append(fname)
                
    secured_ofis = []
    if allowed_files:
        secured_ofis = ofi_repo.get_published_data(allowed_files, owner_id)
        
        # Clean and restore JSON strings to dicts for API response compatibility
        for row in secured_ofis:
            row["ofiTitle"] = row.get("ofiTitle") or "ไม่ระบุหัวข้อ (N/A)"
            row["ofiStatus"] = row.get("ofiStatus") or "ไม่ระบุสถานะ"
            row["elementOwnerId"] = row.get("elementOwnerId") or "ไม่ระบุ Owner"
            
            # Format levels L1-L5
            level_val = str(row.get("ofiLevel") or "").strip().upper()
            if level_val not in ["L1", "L2", "L3", "L4", "L5"]:
                row["ofiLevel"] = "N/A"
            else:
                row["ofiLevel"] = level_val
            row["enablerCode"] = row.get("enablerCode") or "-"
            
            if not row.get("phases"):
                row["phases"] = []

            # Parse JSON strings stored in sqlite back to native objects
            for key, value in row.items():
                if isinstance(value, str):
                    val_str = value.strip()
                    if (val_str.startswith("{") and val_str.endswith("}")) or \
                       (val_str.startswith("[") and val_str.endswith("]")):
                        try:
                            row[key] = json.loads(value)
                        except:
                            pass

    db_response = settings_repository.load_base_structure()
    master_metadata = settings_repository.get_master_metadata()
    
    if "reference" in master_metadata and master_metadata["reference"]:
        db_response["reference"] = master_metadata["reference"]
    if "topicScoreMaster" in master_metadata and master_metadata["topicScoreMaster"]:
        db_response["topicScoreMaster"] = master_metadata["topicScoreMaster"]

    db_response["ofiImprovements"] = secured_ofis
    config = settings_repository.get_system_config()

    return {
        "status": "success",
        "role": role_type,
        "total_records_sent": len(secured_ofis),
        "last_sync": config.get("last_sync"),
        "data": db_response
    }

@router.get("/active-owners", response_model=ActiveOwnersResponse)
async def get_active_owners():
    """Retrieve distinct list of active owners present in the database."""
    owners = ofi_repo.get_active_owners()
    return ActiveOwnersResponse(owners=owners)

@router.get("/owners", response_model=OwnersListResponse)
async def get_owners():
    """Gets list of all owners combining static reference data and active database owners."""
    db_response = settings_repository.load_base_structure()
    owners = []
    seen_ids = set()
    
    master_metadata = settings_repository.get_master_metadata()
    if "reference" in master_metadata and master_metadata["reference"]:
        db_response["reference"] = master_metadata["reference"]
                
    static_owners = db_response.get("reference", {}).get("elementOwners", [])
    for o in static_owners:
        if o.get("id") not in seen_ids:
            owners.append(o)
            seen_ids.add(o.get("id"))
            
    # Add active owners from SQLite who are not in static metadata
    db_owners = ofi_repo.get_sqlite_distinct_owners()
    for owner_name in db_owners:
        if owner_name not in seen_ids:
            owners.append({
                "id": owner_name,
                "nameThai": owner_name,
                "positionThai": "Process Owner",
                "shortPosition": "PO",
                "imageUrl": "assets/avatars/placeholder-1.svg",
                "departmentIds": []
            })
            seen_ids.add(owner_name)
            
    return OwnersListResponse(status="success", data=owners)
