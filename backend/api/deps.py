from fastapi import Header, HTTPException
from typing import Generator, Tuple, Optional
from sqlalchemy.orm import Session
from backend.core.database import db_manager

def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database sessions."""
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()

def get_current_role(authorization: str = Header(None)) -> Tuple[str, Optional[str]]:
    """FastAPI Dependency for extracting and validating authentication tokens/roles."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Token")
    
    token = authorization.split(" ")[1]
    role_type = ""
    owner_id = None

    if token in ["executive", "auditor", "admin"]:
        role_type = token
    elif token.startswith("owner:"):
        role_type = "owner"
        owner_id = token.split(":")[1]
    else:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    return role_type, owner_id
