import asyncio
import json
from sqlalchemy import select
import sys

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.show import Show
from app.models.season import Season
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.auth.passwords import get_password_hash
from app.config import settings

async def seed_db():
    if not settings.seed_on_startup:
        return
        
    async with AsyncSessionLocal() as session:
        # Check if users exist
        res = await session.execute(select(User))
        if not res.scalars().first():
            print("Creating default users...")
            admin = User(
                email=settings.default_admin_email,
                hashed_password=get_password_hash(settings.default_admin_password),
                role="admin"
            )
            editor = User(
                email=settings.default_editor_email,
                hashed_password=get_password_hash(settings.default_editor_password),
                role="editor"
            )
            session.add_all([admin, editor])
            await session.commit()
            
        # Check if shows exist
        res = await session.execute(select(Show))
        if res.scalars().first():
            print("Database already seeded with shows.")
            return
            
        print("Loading seed_shows.json...")
        try:
            with open("seed_shows.json", "r") as f:
                seed_data = json.load(f)
        except Exception as e:
            print(f"Could not load seed_shows.json: {e}")
            return
            
        # Deduplicate shows
        shows_cache = {} # slug -> Show
        seasons_cache = {} # (show_slug, season_number) -> Season
        
        for row in seed_data:
            slug = row["slug"]
            if slug not in shows_cache:
                show = Show(
                    title=row["show_title"],
                    slug=slug,
                    section=row["section"],
                    categories=row["categories"],
                    synopsis=row["synopsis"],
                    status="published" if row["status"] == "published" else "draft"
                )
                session.add(show)
                shows_cache[slug] = show
                
        await session.commit()
        for s in shows_cache.values():
            await session.refresh(s)
            
        for row in seed_data:
            slug = row["slug"]
            show = shows_cache[slug]
            s_num = row["season_number"]
            
            s_key = (slug, s_num)
            if s_key not in seasons_cache:
                season = Season(
                    show_id=show.id,
                    season_number=s_num
                )
                session.add(season)
                seasons_cache[s_key] = season
                
        await session.commit()
        for s in seasons_cache.values():
            await session.refresh(s)

        # Deduplicate episodes in-memory before inserting, instead of relying
        # on per-row savepoints to catch IntegrityError from the DB.
        seen_content_keys: set[tuple[str, str]] = set()

        for row in seed_data:
            show = shows_cache[row["slug"]]
            season = seasons_cache[(row["slug"], row["season_number"])]

            content_key = (row["content_group"], row["language"])
            if content_key in seen_content_keys:
                print(f"Skipping duplicate episode for {row['content_group']} in {row['language']} (caught in-memory).")
                continue
            seen_content_keys.add(content_key)

            ep = Episode(
                show_id=show.id,
                season_id=season.id,
                episode_number=row["episode_number"],
                episode_title=row["episode_title"],
                duration_seconds=row.get("duration_seconds"),
                language=row["language"],
                content_group=row["content_group"],
                status="published" if row["status"] == "published" else "draft",
                original_episode_id=row["episode_id"]
            )
            session.add(ep)

        await session.commit()

        # Refresh episodes so we can attach artwork
        # Re-query all episodes to get their IDs
        ep_result = await session.execute(select(Episode))
        all_episodes = {ep.original_episode_id: ep for ep in ep_result.scalars().all()}

        for row in seed_data:
            content_key = (row["content_group"], row["language"])
            ep = all_episodes.get(row["episode_id"])
            if not ep:
                continue

            artworks = row.get("artwork_available", [])
            for art_type in artworks:
                art = Artwork(
                    episode_id=ep.id,
                    artwork_type=art_type,
                    storage_path=f"artwork/seed/dummy_{ep.id}_{art_type}.jpg",
                    width_px=1920 if art_type == 'banner' else 600,
                    height_px=1080 if art_type == 'banner' else 900,
                    file_size_bytes=1024
                )
                session.add(art)

        await session.commit()
        print("Seed complete.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_db())
