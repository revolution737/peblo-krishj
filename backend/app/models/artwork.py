from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, timezone
from app.models.base import Base

class Artwork(Base):
    __tablename__ = "artwork"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    show_id = Column(UUID(as_uuid=True), ForeignKey("shows.id", ondelete="CASCADE"), nullable=True)
    episode_id = Column(UUID(as_uuid=True), ForeignKey("episodes.id", ondelete="CASCADE"), nullable=True)
    artwork_type = Column(String(20), nullable=False) # 'poster', 'banner', 'thumbnail'
    storage_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=True)
    width_px = Column(Integer, nullable=False)
    height_px = Column(Integer, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("show_id", "artwork_type", name="uq_artwork_show_type"),
        UniqueConstraint("episode_id", "artwork_type", name="uq_artwork_episode_type"),
        CheckConstraint(
            "(show_id IS NOT NULL AND episode_id IS NULL) OR (show_id IS NULL AND episode_id IS NOT NULL)",
            name="chk_artwork_target"
        )
    )
