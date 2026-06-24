from sqlalchemy import Column, String, JSON
from backend.core.database import Base

class OFIItem(Base):
    __tablename__ = "ofi_improvements"
    id = Column(String, primary_key=True, index=True)
    enablerCode = Column(String)
    ofiText = Column(String)
    elementOwnerId = Column(String)
    ofiLevel = Column(String)
    phases = Column(JSON)  # Stores status as JSON object
