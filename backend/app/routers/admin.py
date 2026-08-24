from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from app.database import get_db
from app.models.show import Show
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.models.publish_run import PublishRun
from app.models.audit_log import AuditLog
from app.models.user import User
from app.auth.dependencies import require_editor, require_admin
from app.services.publish import publish_catalogue
from app.services.audit import log_audit_event
from app.storage.local import storage
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
import os
import aiofiles
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/catalog/publish")
async def trigger_publish(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    # --- Server-side validation gate ---
    # Mirror the validation report logic: block publish if any published
    # show/episode has missing section, duration, or artwork.
    shows_res = await db.execute(select(Show).where(Show.status == "published"))
    published_shows = shows_res.scalars().all()

    blocking = []
    for show in published_shows:
        if not show.section:
            blocking.append(f"Show '{show.title}' is published but has no section assigned.")
            continue
        ep_res = await db.execute(select(Episode).where(Episode.show_id == show.id, Episode.status == "published"))
        for ep in ep_res.scalars().all():
            if ep.duration_seconds is None:
                blocking.append(f"Episode '{ep.episode_title}' in '{show.title}' is missing a duration.")
            art_res = await db.execute(select(Artwork).where(Artwork.episode_id == ep.id))
            art_types = {a.artwork_type for a in art_res.scalars().all()}
            missing_art = [t for t in ('poster', 'banner', 'thumbnail') if t not in art_types]
            if len(missing_art) == 3:
                blocking.append(
                    f"Episode '{ep.episode_title}' in '{show.title}' is missing all artwork."
                )
            elif len(missing_art) > 0 and ep.episode_number > 1:
                blocking.append(
                    f"Episode '{ep.episode_title}' in '{show.title}' is missing artwork: {', '.join(missing_art)}."
                )

    if blocking:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(
            status_code=400,
            detail={
                "message": "Cannot publish: blocking issues must be resolved first.",
                "issues": blocking,
            }
        )
    # --- End validation gate ---

    run = await publish_catalogue(db, user["id"])
    await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="PUBLISH", target_type="CATALOG", target_id=str(run.id), details={"shows": run.show_count, "episodes": run.episode_count})
    await db.commit()
    return {"status": run.status, "run_id": str(run.id), "shows": run.show_count, "episodes": run.episode_count}

@router.get("/catalog/history")
async def get_publish_history(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    stmt = select(PublishRun, User.email).join(User, PublishRun.triggered_by == User.id).where(PublishRun.status == "success").order_by(PublishRun.completed_at.desc()).limit(20)
    result = await db.execute(stmt)
    
    history = []
    for run, user_email in result.all():
        history.append({
            "id": str(run.id),
            "triggered_by_email": user_email,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "show_count": run.show_count,
            "episode_count": run.episode_count,
            "catalogue_path": run.catalogue_path
        })
    return {"history": history}

@router.post("/catalog/rollback/{run_id}")
async def rollback_catalog(run_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id format")
        
    stmt = select(PublishRun).where(PublishRun.id == run_uuid, PublishRun.status == "success")
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Publish run not found or was not successful")
        
    if not run.catalogue_path:
        raise HTTPException(status_code=400, detail="Historical catalogue path is missing")
        
    historical_path = os.path.join(storage.base_path, run.catalogue_path)
    if not os.path.exists(historical_path):
        raise HTTPException(status_code=404, detail="Historical catalogue file not found on disk")
        
    live_path = os.path.join(storage.base_path, "catalogue.json")
    tmp_path = os.path.join(storage.base_path, f"catalogue_rollback_{run.id}.json.tmp")
    
    try:
        async with aiofiles.open(historical_path, "r") as f:
            content = await f.read()
            
        async with aiofiles.open(tmp_path, "w") as f:
            await f.write(content)
            
        os.replace(tmp_path, live_path)
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Rollback failed: {str(e)}")
        
    await log_audit_event(db, user_id=uuid.UUID(user["id"]), action="ROLLBACK", target_type="CATALOG", target_id=str(run.id))
    await db.commit()
    return {"status": "success", "message": f"Rolled back to run {run_id}"}

@router.get("/audit-logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    stmt = select(AuditLog, User.email).join(User, AuditLog.user_id == User.id).order_by(AuditLog.created_at.desc()).limit(50)
    result = await db.execute(stmt)
    
    logs = []
    for log, user_email in result.all():
        logs.append({
            "id": str(log.id),
            "user_email": user_email,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
    return {"logs": logs}

@router.get("/validation-report")
async def get_validation_report(db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    # This report groups issues by show and checks for:
    # 1. Missing artwork
    # 2. Null sections on published shows
    # 3. Missing duration on published episodes
    # 4. Inconsistent title casing across a show's episodes
    
    shows_res = await db.execute(select(Show))
    shows = shows_res.scalars().all()
    
    blocking_issues = []
    warnings = []
    publishable_shows = 0
    total_blocking_count = 0
    total_warnings_count = 0
    
    for show in shows:
        show_blocking = []
        show_warnings = []
        
        # Check show section
        if show.status == "published" and not show.section:
            show_blocking.append({
                "type": "missing_section",
                "message": "This show has no section assigned. Choose from: featured, series, minisodes, songs."
            })
            
        # Get episodes
        ep_res = await db.execute(select(Episode).where(Episode.show_id == show.id))
        episodes = ep_res.scalars().all()
        
        casing_reference = None
        for ep in episodes:
            # Check title casing (basic heuristic)
            if casing_reference is None:
                casing_reference = ep.episode_title.isupper()
            elif ep.episode_title.isupper() != casing_reference:
                show_warnings.append({
                    "type": "inconsistent_title_casing",
                    "episode": f"S{ep.season_id}E{ep.episode_number}", # ideally join with season to get number, assuming we fetch it
                    "message": f"Episode title '{ep.episode_title}' uses different casing than other episodes."
                })
            
            if ep.status == "published":
                if ep.duration_seconds is None:
                    show_blocking.append({
                        "type": "missing_duration",
                        "episode": ep.episode_title,
                        "message": "Episodes need a duration before they can be published."
                    })
                
                # Check artwork
                art_res = await db.execute(select(Artwork).where(Artwork.episode_id == ep.id))
                artworks = art_res.scalars().all()
                types = [a.artwork_type for a in artworks]
                
                # Trailers (season 0) might only need thumbnails, but normal episodes need all 3
                # We'll just check if artwork is completely missing or missing types
                missing = [t for t in ['poster', 'banner', 'thumbnail'] if t not in types]
                
                # if season 0 (we'd need season join here, let's just check if missing is 3 for all, or enforce strictly)
                if len(missing) == 3:
                    show_blocking.append({
                        "type": "missing_artwork",
                        "episode": ep.episode_title,
                        "message": "Missing all artwork (poster, banner, thumbnail). Upload artwork before publishing."
                    })
                elif len(missing) > 0 and ep.episode_number > 1: # simplistic season 0 proxy if we don't join
                    show_blocking.append({
                        "type": "missing_artwork",
                        "episode": ep.episode_title,
                        "message": f"Missing artwork: {', '.join(missing)}. Upload artwork before publishing."
                    })
                    
        if show_blocking:
            blocking_issues.append({
                "show": show.title,
                "issues": show_blocking
            })
            total_blocking_count += len(show_blocking)
        else:
            publishable_shows += 1
            
        if show_warnings:
            warnings.append({
                "show": show.title,
                "issues": show_warnings
            })
            total_warnings_count += len(show_warnings)
            
    return {
        "blocking_issues": blocking_issues,
        "warnings": warnings,
        "summary": {
            "total_shows": len(shows),
            "publishable_shows": publishable_shows,
            "total_blocking_issues": total_blocking_count,
            "total_warnings": total_warnings_count
        }
    }
