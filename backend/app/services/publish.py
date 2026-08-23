import json
import os
import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid

from app.models.show import Show
from app.models.season import Season
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.models.publish_run import PublishRun
from app.storage.local import storage

async def publish_catalogue(db: AsyncSession, user_id: uuid.UUID) -> PublishRun:
    # 1. Create a publish_run record with status 'running'
    run = PublishRun(
        triggered_by=user_id,
        status="running"
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    try:
        # 2. Query all published shows
        shows_res = await db.execute(select(Show).where(Show.status == "published").order_by(Show.title))
        shows = shows_res.scalars().all()

        sections_dict = {
            "featured": [],
            "series": [],
            "minisodes": [],
            "songs": []
        }
        
        show_count = 0
        episode_count = 0

        for show in shows:
            if not show.section:
                continue # Should be caught by validation report
                
            show_count += 1
            show_data = {
                "id": str(show.id),
                "title": show.title,
                "slug": show.slug,
                "synopsis": show.synopsis,
                "categories": show.categories,
                "artwork": {},
                "seasons": []
            }
            
            # Fetch show artwork
            art_res = await db.execute(select(Artwork).where(Artwork.show_id == show.id))
            for art in art_res.scalars().all():
                show_data["artwork"][art.artwork_type] = await storage.get_url(art.storage_path)
                
            # Fetch seasons
            season_res = await db.execute(select(Season).where(Season.show_id == show.id).order_by(Season.season_number))
            seasons = season_res.scalars().all()
            
            for season in seasons:
                season_data = {
                    "season_number": season.season_number,
                    "is_trailer_season": season.season_number == 0,
                    "episodes": []
                }
                
                # Fetch published episodes for this season
                ep_res = await db.execute(select(Episode).where(Episode.season_id == season.id, Episode.status == "published").order_by(Episode.episode_number))
                episodes = ep_res.scalars().all()
                
                # Content Group Collapsing
                collapsed_episodes = {}
                for ep in episodes:
                    cg = ep.content_group
                    if cg not in collapsed_episodes:
                        collapsed_episodes[cg] = {
                            "episode_number": ep.episode_number,
                            "title": ep.episode_title,
                            "content_group": cg,
                            "languages": [ep.language],
                            "duration_seconds": ep.duration_seconds,
                            "artwork": {}
                        }
                        # Fetch artwork for the first representative episode
                        # Realistically, they should share artwork or we pick one
                        ep_art_res = await db.execute(select(Artwork).where(Artwork.episode_id == ep.id))
                        for art in ep_art_res.scalars().all():
                            collapsed_episodes[cg]["artwork"][art.artwork_type] = await storage.get_url(art.storage_path)
                    else:
                        collapsed_episodes[cg]["languages"].append(ep.language)
                        
                # Sort languages deterministically and append to season
                for cg_data in collapsed_episodes.values():
                    cg_data["languages"].sort()
                    season_data["episodes"].append(cg_data)
                    episode_count += 1
                    
                if season_data["episodes"]:
                    show_data["seasons"].append(season_data)
                    
            if show.section in sections_dict:
                sections_dict[show.section].append(show_data)

        # Build final structure
        sections_list = []
        for sec_id, sec_shows in sections_dict.items():
            if sec_shows:
                sections_list.append({
                    "id": sec_id,
                    "shows": sec_shows
                })
                
        catalogue_data = {
            "published_at": datetime.now(timezone.utc).isoformat(),
            "version": str(run.id),
            "sections": sections_list
        }
        
        # Atomic Write
        # Write to .tmp first, then copy to history file, then replace live file
        json_str = json.dumps(catalogue_data, indent=2)
        base_dir = storage.base_path
        tmp_path = os.path.join(base_dir, f"catalogue_{run.id}.json.tmp")
        final_path = os.path.join(base_dir, f"catalogue_{run.id}.json")
        live_path = os.path.join(base_dir, "catalogue.json")
        
        async with aiofiles.open(tmp_path, "w") as f:
            await f.write(json_str)
            
        import shutil
        shutil.copy2(tmp_path, final_path)
        os.replace(tmp_path, live_path)
        
        # Update run record
        run.status = "success"
        run.completed_at = datetime.now(timezone.utc)
        run.show_count = show_count
        run.episode_count = episode_count
        run.catalogue_path = f"catalogue_{run.id}.json"
        
    except Exception as e:
        run.status = "failed"
        run.error_message = str(e)
        run.completed_at = datetime.now(timezone.utc)
        
    await db.commit()
    return run
