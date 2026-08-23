from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.database import get_db
from app.models.season import Season
from app.schemas.common import SeasonCreate, SeasonUpdate, SeasonResponse
from app.auth.dependencies import require_editor

router = APIRouter(prefix="/admin/shows/{show_id}/seasons", tags=["admin/seasons"])

@router.get("/", response_model=List[SeasonResponse])
async def list_seasons(show_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    result = await db.execute(select(Season).where(Season.show_id == show_id).order_by(Season.season_number))
    return result.scalars().all()

@router.post("/", response_model=SeasonResponse)
async def create_season(show_id: uuid.UUID, season: SeasonCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    db_season = Season(show_id=show_id, **season.model_dump())
    db.add(db_season)
    try:
        await db.commit()
        await db.refresh(db_season)
        return db_season
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
