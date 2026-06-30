import time
from fastapi import APIRouter, Request, Body, Response
from backend.services.pdf_export_service import pdf_export_service

router = APIRouter()

@router.get("/export-pdf/{role}")
async def export_pdf_get(
    request: Request,
    role: str,
    width: int = 1440,
    wait_ms: int = 3000,
    nocache: bool = False,
):
    """Generates a PDF report via GET request."""
    pdf_export_service.validate_role(role)
    return await pdf_export_service.export(
        request, 
        role=role, 
        fmt="pdf",
        width=width, 
        wait_ms=wait_ms, 
        nocache=nocache,
        filename=f"PTT_OFI_{role.upper()}_Report_2026.pdf",
        content_type="application/pdf",
    )

@router.post("/export-pdf/{role}")
async def export_pdf_post(
    request: Request,
    role: str,
    width: int = 1440,
    wait_ms: int = 3000,
    nocache: bool = False,
    payload: dict = Body(default={}),
):
    """Generates a PDF report via POST request, supporting local/session and DOM state synchronization."""
    pdf_export_service.validate_role(role)
    return await pdf_export_service.export(
        request, 
        role=role, 
        fmt="pdf",
        width=width, 
        wait_ms=wait_ms, 
        nocache=nocache,
        filename=f"PTT_OFI_{role.upper()}_Report_{int(time.time())}.pdf",
        content_type="application/pdf",
        local_state=payload.get("local_state") or payload.get("localState") or {},
        session_state=payload.get("session_state") or payload.get("sessionState") or {},
        dom_state=payload.get("dom_state") or payload.get("domState") or [],
    )

@router.post("/export-jpg/{role}")
async def export_jpg(
    request: Request,
    role: str,
    width: int = 1440,
    wait_ms: int = 2000,
    nocache: bool = False,
    payload: dict = Body(default={}),
):
    """Generates a JPEG report via POST request, supporting local/session and DOM state synchronization."""
    pdf_export_service.validate_role(role)
    return await pdf_export_service.export(
        request, 
        role=role, 
        fmt="jpg",
        width=width, 
        wait_ms=wait_ms, 
        nocache=nocache,
        filename=f"PTT_OFI_{role.upper()}_Report_{int(time.time())}.jpg",
        content_type="image/jpeg",
        local_state=payload.get("local_state") or payload.get("localState") or {},
        session_state=payload.get("session_state") or payload.get("sessionState") or {},
        dom_state=payload.get("dom_state") or payload.get("domState") or [],
    )
