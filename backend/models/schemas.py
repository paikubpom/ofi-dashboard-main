from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class AutoUpdateSetting(BaseModel):
    auto_update: bool

class FileInfo(BaseModel):
    name: str
    created: float
    modified: float
    isActive: bool

class FileListResponse(BaseModel):
    files: List[FileInfo]

class GenericResponse(BaseModel):
    status: str
    message: str

class OwnerItem(BaseModel):
    id: str
    nameThai: str
    positionThai: str
    shortPosition: str
    imageUrl: str
    departmentIds: List[str]

class OwnersListResponse(BaseModel):
    status: str
    data: List[OwnerItem]

class ActiveOwnersResponse(BaseModel):
    owners: List[str]

class SyncResponse(BaseModel):
    status: str
    last_sync: Optional[float]
