from sqlalchemy import Column, String, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID, ARRAY
import uuid
from datetime import datetime, timezone
from app.models.base import Base

class Show(Base):
    __tablename__ = "shows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    section = Column(String(50), nullable=True) # nullable for drafts
    categories = Column(ARRAY(String), nullable=False, default=list)
    synopsis = Column(String, nullable=True)
    status = Column(String(20), nullable=False) # 'draft' or 'published'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

# Index for publish job to efficiently grab published shows by section
Index("idx_shows_section", Show.section, postgresql_where=(Show.status == 'published'))
