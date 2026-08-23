from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
from app.models.base import Base

class Episode(Base):
    __tablename__ = "episodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    show_id = Column(UUID(as_uuid=True), ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    season_id = Column(UUID(as_uuid=True), ForeignKey("seasons.id", ondelete="CASCADE"), nullable=False, index=True)
    episode_number = Column(Integer, nullable=False)
    episode_title = Column(String, nullable=False)
    duration_seconds = Column(Integer, nullable=True) # nullable, caught by validation before publish
    language = Column(String(10), nullable=False)
    content_group = Column(String, nullable=False, index=True)
    status = Column(String(20), nullable=False) # 'draft' or 'published'
    original_episode_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("content_group", "language", name="uq_content_group_language"),
    )
