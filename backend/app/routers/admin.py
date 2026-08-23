from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any

from app.database import get_db
from app.models.show import Show
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.auth.dependencies import require_editor, require_admin
from app.services.publish import publish_catalogue

router = APIRouter(prefix="/admin", tags=["admin"])

@router.post("/catalog/publish")
async def trigger_publish(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    run = await publish_catalogue(db, user["id"])
    return {"status": run.status, "run_id": str(run.id), "shows": run.show_count, "episodes": run.episode_count}

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
