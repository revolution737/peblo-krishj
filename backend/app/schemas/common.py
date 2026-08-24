from typing import List, Optional
import uuid
from datetime import datetime
from pydantic import BaseModel, field_validator

class ShowBase(BaseModel):
    title: str
    slug: str
    section: str | None = None
    categories: list[str] = []
    synopsis: str | None = None
    status: str

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ('draft', 'published'):
            raise ValueError('Status must be draft or published')
        return v

    @field_validator('section')
    @classmethod
    def validate_section(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = {"featured", "series", "minisodes", "songs"}
        if v not in allowed:
            raise ValueError(f'Section must be one of {allowed}')
        return v

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
    duration_seconds: int | None = None
    language: str
    content_group: str
    status: str

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ('draft', 'published'):
            raise ValueError('Status must be draft or published')
        return v

class EpisodeCreate(EpisodeBase):
    show_id: uuid.UUID
    season_id: uuid.UUID
    original_episode_id: str | None = None

class EpisodeUpdate(EpisodeBase):
    pass

class EpisodeResponse(EpisodeBase):
    id: uuid.UUID
    show_id: uuid.UUID
    season_id: uuid.UUID
    original_episode_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
