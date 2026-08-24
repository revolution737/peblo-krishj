from fastapi import APIRouter
import json
import os
import aiofiles

from app.schemas.catalog import CatalogResponse
from app.storage.local import storage

router = APIRouter(prefix="/catalog", tags=["catalog"])

_CATALOG_CACHE = None
_CACHE_MTIME = 0.0

async def get_cached_catalog():
    global _CATALOG_CACHE, _CACHE_MTIME
    live_path = os.path.join(storage.base_path, "catalogue.json")
    if not os.path.exists(live_path):
        return {"published_at": None, "version": None, "sections": []}
        
    mtime = os.path.getmtime(live_path)
    if _CATALOG_CACHE is None or mtime > _CACHE_MTIME:
        async with aiofiles.open(live_path, "r") as f:
            data = await f.read()
            _CATALOG_CACHE = json.loads(data)
            _CACHE_MTIME = mtime
            
    return _CATALOG_CACHE

@router.get("/", response_model=CatalogResponse)
async def get_catalog():
    return await get_cached_catalog()

@router.get("/search", response_model=CatalogResponse)
async def search_catalog(
    q: str | None = None,
    category: str | None = None,
    language: str | None = None,
    section: str | None = None
):
    # This is a naive in-memory search over the published catalogue.
    # We now cache the JSON in memory and filter it.
    
    catalog = await get_cached_catalog()
    if not catalog.get("sections"):
        return catalog
        
    q = q.lower() if q else None
    
    filtered_sections = []
    
    for sec in catalog.get("sections", []):
        if section and sec["id"] != section:
            continue
            
        filtered_shows = []
        for show in sec.get("shows", []):
            if category and category not in show.get("categories", []):
                continue
                
            show_matches_q = False
            if q and (q in show["title"].lower() or any(q in cat.lower() for cat in show["categories"])):
                show_matches_q = True
                
            filtered_seasons = []
            for szn in show.get("seasons", []):
                # Filter out Season 0 (trailers) from normal search results unless explicitly wanted?
                # Actually, viewers can search for trailers too, but let's just stick to normal filtering
                
                filtered_episodes = []
                for ep in szn.get("episodes", []):
                    if language and language not in ep.get("languages", []):
                        continue
                    
                    ep_matches_q = False
                    if q and q in ep["title"].lower():
                        ep_matches_q = True
                        
                    if (not q) or show_matches_q or ep_matches_q:
                        filtered_episodes.append(ep)
                        
                if filtered_episodes:
                    # Keep only matched episodes
                    # If we matched on show-level q, we keep all episodes matching language/category
                    szn_copy = dict(szn)
                    szn_copy["episodes"] = filtered_episodes
                    filtered_seasons.append(szn_copy)
            
            if filtered_seasons:
                show_copy = dict(show)
                show_copy["seasons"] = filtered_seasons
                filtered_shows.append(show_copy)
                
        if filtered_shows:
            sec_copy = dict(sec)
            sec_copy["shows"] = filtered_shows
            filtered_sections.append(sec_copy)
            
    return {
        "published_at": catalog.get("published_at"),
        "version": catalog.get("version"),
        "sections": filtered_sections
    }
