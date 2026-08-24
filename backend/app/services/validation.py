from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.show import Show
from app.models.season import Season
from app.models.episode import Episode
from app.models.artwork import Artwork

async def get_catalog_validation_report(db: AsyncSession) -> dict:
    """
    Evaluates the entire catalog and returns a structured validation report.
    Checks for:
    1. Missing artwork (distinguishing trailers from normal episodes)
    2. Null sections on published shows
    3. Missing duration on published episodes
    4. Inconsistent title casing across a show's episodes
    """
    stmt = (
        select(Show)
        .options(
            selectinload(Show.seasons)
            .selectinload(Season.episodes)
            .selectinload(Episode.artwork_items),
        )
        .order_by(Show.title)
    )
    result = await db.execute(stmt)
    shows = result.scalars().unique().all()

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
                "message": "This show has no section assigned. Choose from: featured, series, minisodes, songs.",
            })

        # Check episodes via eagerly-loaded seasons
        casing_reference = None
        for season in show.seasons:
            is_trailer_season = season.season_number == 0
            for ep in season.episodes:
                # Check title casing (basic heuristic)
                if casing_reference is None:
                    casing_reference = ep.episode_title.isupper()
                elif ep.episode_title.isupper() != casing_reference:
                    show_warnings.append({
                        "type": "inconsistent_title_casing",
                        "episode": f"S{season.season_number}E{ep.episode_number}",
                        "message": f"Episode title '{ep.episode_title}' uses different casing than other episodes.",
                    })

                if ep.status == "published":
                    if ep.duration_seconds is None:
                        show_blocking.append({
                            "type": "missing_duration",
                            "episode": ep.episode_title,
                            "message": "Episodes need a duration before they can be published.",
                        })

                    art_types = [a.artwork_type for a in ep.artwork_items]
                    missing = [t for t in ("poster", "banner", "thumbnail") if t not in art_types]

                    if len(missing) == 3:
                        show_blocking.append({
                            "type": "missing_artwork",
                            "episode": ep.episode_title,
                            "message": "Missing all artwork (poster, banner, thumbnail). Upload artwork before publishing.",
                        })
                    elif missing and not is_trailer_season:
                        show_blocking.append({
                            "type": "missing_artwork",
                            "episode": ep.episode_title,
                            "message": f"Missing artwork: {', '.join(missing)}. Upload artwork before publishing.",
                        })

        if show_blocking:
            blocking_issues.append({
                "show": show.title,
                "issues": show_blocking,
            })
            total_blocking_count += len(show_blocking)
        else:
            publishable_shows += 1

        if show_warnings:
            warnings.append({
                "show": show.title,
                "issues": show_warnings,
            })
            total_warnings_count += len(show_warnings)

    return {
        "blocking_issues": blocking_issues,
        "warnings": warnings,
        "summary": {
            "total_shows": len(shows),
            "publishable_shows": publishable_shows,
            "total_blocking_issues": total_blocking_count,
            "total_warnings": total_warnings_count,
        },
    }

async def validate_episode_publishable(db: AsyncSession, episode: Episode) -> list[str]:
    """
    Checks if a single episode meets the requirements to be published.
    Returns a list of error message strings. If empty, the episode is publishable.
    """
    errors = []
    
    if episode.duration_seconds is None:
        errors.append("Episodes need a duration before they can be published.")
        
    # Check if the episode is a trailer (Season 0)
    # We query the season to see its number
    season_result = await db.execute(select(Season).where(Season.id == episode.season_id))
    season = season_result.scalar_one_or_none()
    is_trailer = season and season.season_number == 0

    artwork_res = await db.execute(select(Artwork).where(Artwork.episode_id == episode.id))
    artworks = artwork_res.scalars().all()
    art_types = [a.artwork_type for a in artworks]
    
    missing = [t for t in ['poster', 'banner', 'thumbnail'] if t not in art_types]
    if len(missing) == 3:
        errors.append("Missing all artwork (poster, banner, thumbnail). Upload artwork before publishing.")
    elif missing and not is_trailer:
        errors.append(f"This episode is missing artwork: {', '.join(missing)}. Upload them before publishing.")
        
    return errors
