import sys
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

# Apply Windows loop policy if needed for Playwright
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from backend.core.config import settings
from backend.core.database import db_manager
from backend.services.pdf_export_service import pdf_export_service
from backend.api.v1.endpoints import files, dashboard, export, settings as settings_routes

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    db_manager.initialize_database()
    
    # Initialize Playwright browser
    await pdf_export_service.initialize()
    yield
    # Cleanup browser on shutdown
    await pdf_export_service.close()

app = FastAPI(title="OFI Clean OOP Integration API", lifespan=lifespan)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTML Views serving
@app.get("/executive")
def read_executive(): 
    return FileResponse("dist/executive.html")

@app.get("/auditor")
def read_auditor(): 
    return FileResponse("dist/auditor.html")

@app.get("/owner")
def read_owner(): 
    return FileResponse("dist/owner.html")

@app.get("/admin")
def read_admin(): 
    return FileResponse("dist/admin.html")

# Include Routers
app.include_router(files.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")

# Static Files serving
app.mount("/static-data", StaticFiles(directory=settings.DATA_FOLDER), name="static-data")
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")