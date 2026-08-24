from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid

from app.database import get_db
from app.models.show import Show
from app.schemas.common import ShowCreate, ShowUpdate, ShowResponse
from app.auth.dependencies import require_editor
from app.services.audit import log_audit_event

router = APIRouter(prefix="/admin/shows", tags=["admin/shows"])

@router.get("/", response_model=list[ShowResponse])
async def list_shows(
    skip: int = 0,
    limit: int = 100,
    section: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db), 
    user: dict = Depends(require_editor)
):
    query = select(Show).order_by(Show.title)
    if section:
        query = query.where(Show.section == section)
    if status:
        query = query.where(Show.status == status)
        
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=ShowResponse)
async def create_show(show: ShowCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    if show.status == "published" and show.section is None:
        raise HTTPException(status_code=400, detail="This show needs a section before it can be published. Choose from: featured, series, minisodes, songs.")
    
    db_show = Show(**show.model_dump())
    db.add(db_show)
    try:
        await db.flush()
        await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="CREATE", target_type="SHOW", target_id=str(db_show.id), details={"title": db_show.title})
        await db.commit()
        await db.refresh(db_show)
        return db_show
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{show_id}", response_model=ShowResponse)
async def get_show(show_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Show).where(Show.id == show_id))
    show = result.scalar_one_or_none()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    return show

@router.put("/{show_id}", response_model=ShowResponse)
async def update_show(show_id: uuid.UUID, show_update: ShowUpdate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Show).where(Show.id == show_id))
    db_show = result.scalar_one_or_none()
    if not db_show:
        raise HTTPException(status_code=404, detail="Show not found")
        
    if show_update.status == "published" and show_update.section is None:
        raise HTTPException(status_code=400, detail="This show needs a section before it can be published. Choose from: featured, series, minisodes, songs.")

    for key, value in show_update.model_dump().items():
        setattr(db_show, key, value)
        
    try:
        await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="UPDATE", target_type="SHOW", target_id=str(db_show.id), details={"title": db_show.title})
        await db.commit()
        await db.refresh(db_show)
        return db_show
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{show_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_show(show_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Show).where(Show.id == show_id))
    db_show = result.scalar_one_or_none()
    if not db_show:
        raise HTTPException(status_code=404, detail="Show not found")
    await db.delete(db_show)
    await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="DELETE", target_type="SHOW", target_id=str(show_id))
    await db.commit()
