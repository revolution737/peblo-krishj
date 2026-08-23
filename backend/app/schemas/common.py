from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime

class ShowBase(BaseModel):
    title: str
    slug: str
    section: Optional[str] = None
    categories: List[str] = []
    synopsis: Optional[str] = None
    status: str

class ShowCreate(ShowBase):
    pass

class ShowUpdate(ShowBase):
    pass

class ShowResponse(ShowBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SeasonBase(BaseModel):
    season_number: int

class SeasonCreate(SeasonBase):
    pass

class SeasonUpdate(SeasonBase):
    pass

class SeasonResponse(SeasonBase):
    id: uuid.UUID
    show_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class EpisodeBase(BaseModel):
    episode_number: int
    episode_title: str
    duration_seconds: Optional[int] = None
    language: str
    content_group: str
    status: str

class EpisodeCreate(EpisodeBase):
    show_id: uuid.UUID
    season_id: uuid.UUID
    original_episode_id: Optional[str] = None

class EpisodeUpdate(EpisodeBase):
    pass

class EpisodeResponse(EpisodeBase):
    id: uuid.UUID
    show_id: uuid.UUID
    season_id: uuid.UUID
    original_episode_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
