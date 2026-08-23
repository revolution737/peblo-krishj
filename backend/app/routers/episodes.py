from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.database import get_db
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.schemas.common import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.auth.dependencies import require_editor

router = APIRouter(prefix="/admin/episodes", tags=["admin/episodes"])

@router.get("/", response_model=List[EpisodeResponse])
async def list_episodes(show_id: uuid.UUID = None, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    stmt = select(Episode).order_by(Episode.episode_number)
    if show_id:
        stmt = stmt.where(Episode.show_id == show_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=EpisodeResponse)
async def create_episode(episode: EpisodeCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    if episode.status == "published":
        if episode.duration_seconds is None:
            raise HTTPException(status_code=400, detail="Episodes need a duration before they can be published.")
            
    db_episode = Episode(**episode.model_dump())
    db.add(db_episode)
    try:
        await db.commit()
        await db.refresh(db_episode)
        return db_episode
    except Exception as e:
        await db.rollback()
        # Handle unique constraint violation for content_group + language
        if "uq_content_group_language" in str(e):
            raise HTTPException(status_code=400, detail=f"There's already a {episode.language} version for content group {episode.content_group}. Each language can only appear once per content group.")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{episode_id}", response_model=EpisodeResponse)
async def get_episode(episode_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Episode).where(Episode.id == episode_id))
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    return episode

@router.put("/{episode_id}", response_model=EpisodeResponse)
async def update_episode(episode_id: uuid.UUID, episode_update: EpisodeUpdate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Episode).where(Episode.id == episode_id))
    db_episode = result.scalar_one_or_none()
    if not db_episode:
        raise HTTPException(status_code=404, detail="Episode not found")
        
    if episode_update.status == "published":
        if episode_update.duration_seconds is None:
            raise HTTPException(status_code=400, detail="Episodes need a duration before they can be published.")
        
        # Check artwork
        artwork_res = await db.execute(select(Artwork).where(Artwork.episode_id == episode_id))
        artworks = artwork_res.scalars().all()
        types = [a.artwork_type for a in artworks]
        missing = [t for t in ['poster', 'banner', 'thumbnail'] if t not in types]
        if missing:
            raise HTTPException(status_code=400, detail=f"This episode is missing artwork: {', '.join(missing)}. Upload them before publishing.")

    for key, value in episode_update.model_dump().items():
        setattr(db_episode, key, value)
        
    try:
        await db.commit()
        await db.refresh(db_episode)
        return db_episode
    except Exception as e:
        await db.rollback()
        if "uq_content_group_language" in str(e):
            raise HTTPException(status_code=400, detail=f"There's already a {episode_update.language} version for content group {episode_update.content_group}. Each language can only appear once per content group.")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_episode(episode_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Episode).where(Episode.id == episode_id))
    db_episode = result.scalar_one_or_none()
    if not db_episode:
        raise HTTPException(status_code=404, detail="Episode not found")
    await db.delete(db_episode)
    await db.commit()
