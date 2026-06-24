import os

class Settings:
    DATA_FOLDER: str = "data"
    DATABASE_URL: str = "sqlite:///./data/ofi_data.db"
    DASHBOARD_BASE_URL: str = os.getenv("DASHBOARD_BASE_URL", "http://localhost:8000")
    EXPORT_CACHE_TTL: int = int(os.getenv("EXPORT_CACHE_TTL", 300))

settings = Settings()
