from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.season import Season
from app.schemas.common import SeasonCreate, SeasonResponse
from app.auth.dependencies import require_editor

# Nested router: /admin/shows/{show_id}/seasons/  (REST-canonical)
router = APIRouter(prefix="/admin/shows/{show_id}/seasons", tags=["admin/seasons"])

@router.get("/", response_model=list[SeasonResponse])
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


# Flat router: /admin/seasons?show_id=  — what the CMS currently calls
flat_seasons_router = APIRouter(prefix="/admin/seasons", tags=["admin/seasons"])

@flat_seasons_router.get("/", response_model=list[SeasonResponse])
async def list_seasons_flat(
    show_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_editor)
):
    """GET /admin/seasons?show_id={uuid} — flat alternative to the nested route."""
    query = select(Season).order_by(Season.season_number)
    if show_id:
        query = query.where(Season.show_id == show_id)
    result = await db.execute(query)
    return result.scalars().all()


class SeasonFlatCreate(SeasonCreate):
    show_id: uuid.UUID


@flat_seasons_router.post("/", response_model=SeasonResponse)
async def create_season_flat(
    season_data: SeasonFlatCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_editor)
):
    """POST /admin/seasons — body must include show_id and season_number."""
    db_season = Season(show_id=season_data.show_id, season_number=season_data.season_number)
    db.add(db_season)
    try:
        await db.commit()
        await db.refresh(db_season)
        return db_season
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
