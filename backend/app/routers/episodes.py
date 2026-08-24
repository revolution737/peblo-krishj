from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.episode import Episode
from app.schemas.common import EpisodeCreate, EpisodeUpdate, EpisodeResponse
from app.auth.dependencies import require_editor
from app.services.validation import validate_episode_publishable
from app.services.audit import log_audit_event

router = APIRouter(prefix="/admin/episodes", tags=["admin/episodes"])

@router.get("/", response_model=list[EpisodeResponse])
async def list_episodes(
    skip: int = 0,
    limit: int = 100,
    show_id: uuid.UUID | None = None,
    status: str | None = None,
    language: str | None = None,
    db: AsyncSession = Depends(get_db), 
    user: dict = Depends(require_editor)
):
    stmt = select(Episode).order_by(Episode.episode_number)
    if show_id:
        stmt = stmt.where(Episode.show_id == show_id)
    if status:
        stmt = stmt.where(Episode.status == status)
    if language:
        stmt = stmt.where(Episode.language == language)
        
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=EpisodeResponse)
async def create_episode(episode: EpisodeCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    if episode.status == "published" and episode.duration_seconds is None:
            raise HTTPException(status_code=400, detail="Episodes need a duration before they can be published.")
            
    db_episode = Episode(**episode.model_dump())
    db.add(db_episode)
    try:
        await db.flush()
        await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="CREATE", target_type="EPISODE", target_id=str(db_episode.id), details={"title": db_episode.episode_title})
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
        
    for key, value in episode_update.model_dump().items():
        setattr(db_episode, key, value)
        
    if episode_update.status == "published":
        errors = await validate_episode_publishable(db, db_episode)
        if errors:
            raise HTTPException(status_code=400, detail=errors[0])
        
    try:
        await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="UPDATE", target_type="EPISODE", target_id=str(db_episode.id), details={"title": db_episode.episode_title})
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
    await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="DELETE", target_type="EPISODE", target_id=str(episode_id))
    await db.commit()
