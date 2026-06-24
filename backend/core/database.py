import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from backend.core.config import settings

class DatabaseManager:
    def __init__(self, db_url: str = settings.DATABASE_URL):
        self.db_url = db_url
        # For SQLAlchemy ORM operations
        self.engine = create_engine(
            self.db_url, 
            connect_args={"check_same_thread": False} if self.db_url.startswith("sqlite") else {}
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.Base = declarative_base()

    def initialize_database(self) -> None:
        """Create all tables defined in the Base metadata."""
        # Create directories if they don't exist
        db_path = self.get_db_path()
        if db_path:
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.Base.metadata.create_all(bind=self.engine)

    def get_session(self) -> Session:
        """Return a new SQLAlchemy Session."""
        return self.SessionLocal()

    def get_connection(self) -> sqlite3.Connection:
        """Return a direct sqlite3 connection (useful for Pandas read_sql_query)."""
        db_path = self.get_db_path()
        if not db_path:
            raise ValueError("Direct SQLite connection is only supported for SQLite databases.")
        return sqlite3.connect(db_path)

    def get_db_path(self) -> str:
        """Extract file path from sqlite connection string if applicable."""
        if self.db_url.startswith("sqlite:///"):
            return self.db_url.replace("sqlite:///", "")
        return ""

db_manager = DatabaseManager()
Base = db_manager.Base
