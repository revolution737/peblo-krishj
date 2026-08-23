from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import os
import aiofiles

from app.database import get_db
from app.schemas.catalog import CatalogResponse
from app.storage.local import storage

router = APIRouter(prefix="/catalog", tags=["catalog"])

@router.get("/", response_model=CatalogResponse)
async def get_catalog():
    live_path = os.path.join(storage.base_path, "catalogue.json")
    if not os.path.exists(live_path):
        return {"published_at": None, "version": None, "sections": []}
        
    async with aiofiles.open(live_path, "r") as f:
        data = await f.read()
        return json.loads(data)

@router.get("/search", response_model=CatalogResponse)
async def search_catalog(
    q: Optional[str] = None,
    category: Optional[str] = None,
    language: Optional[str] = None,
    section: Optional[str] = None
):
    # This is a naive in-memory search over the published catalogue.
    # In production, this would be a DB query with pg_trgm or Elasticsearch.
    # We load the JSON and filter it.
    
    live_path = os.path.join(storage.base_path, "catalogue.json")
    if not os.path.exists(live_path):
        return {"published_at": None, "version": None, "sections": []}
        
    async with aiofiles.open(live_path, "r") as f:
        data = await f.read()
        catalog = json.loads(data)
        
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
