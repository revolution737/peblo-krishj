"""
Tests for the publish pipeline:
  - content_group collapsing (two language variants → one catalogue entry)
  - season 0 (trailers) are included with is_trailer_season=True
  - languages list is sorted deterministically
  - unpublished episodes are excluded
  - shows without a section are skipped
"""
import pytest
import pytest_asyncio
import os
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.publish import publish_catalogue
from app.models.publish_run import PublishRun


# ──────────────────────────────────────────────
# Helpers — build lightweight fake ORM objects
# ──────────────────────────────────────────────

def _show(title="Test Show", slug="test-show", section="series", status="published"):
    s = MagicMock()
    s.id = uuid.uuid4()
    s.title = title
    s.slug = slug
    s.section = section
    s.synopsis = "A test show."
    s.categories = ["adventure"]
    s.status = status
    return s

def _season(show_id, number=1):
    s = MagicMock()
    s.id = uuid.uuid4()
    s.show_id = show_id
    s.season_number = number
    return s

def _episode(show_id, season_id, number=1, title="Ep Title", language="en",
             content_group="cg-1", status="published", duration=300):
    e = MagicMock()
    e.id = uuid.uuid4()
    e.show_id = show_id
    e.season_id = season_id
    e.episode_number = number
    e.episode_title = title
    e.language = language
    e.content_group = content_group
    e.status = status
    e.duration_seconds = duration
    return e


def _make_db(shows, seasons_by_show, episodes_by_season, artwork_by_ep=None, artwork_by_show=None):
    """Return an AsyncSession mock wired to return the given data."""
    artwork_by_ep = artwork_by_ep or {}
    artwork_by_show = artwork_by_show or {}

    async def fake_execute(stmt):
        result = MagicMock()
        # We can't inspect the SQL easily, so we patch at call-site level instead.
        # Each test patches individual calls. This stub is intentionally minimal.
        result.scalars.return_value.all.return_value = []
        result.scalar_one_or_none.return_value = None
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)
    return db


# ──────────────────────────────────────────────
# Unit tests using patched storage + DB
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_content_group_collapsing():
    """Two episodes sharing a content_group but different languages collapse into
    one catalogue entry with both languages in a sorted list."""
    show = _show()
    season = _season(show.id)
    ep_en = _episode(show.id, season.id, language="en", content_group="cg-1")
    ep_hi = _episode(show.id, season.id, language="hi", content_group="cg-1")

    call_count = [0]

    async def fake_execute(stmt):
        result = MagicMock()
        c = call_count[0]
        call_count[0] += 1

        if c == 0:  # published shows query
            result.scalars.return_value.all.return_value = [show]
        elif c == 1:  # show artwork
            result.scalars.return_value.all.return_value = []
        elif c == 2:  # seasons
            result.scalars.return_value.all.return_value = [season]
        elif c == 3:  # published episodes for season
            result.scalars.return_value.all.return_value = [ep_en, ep_hi]
        elif c == 4:  # artwork for ep_en (representative)
            result.scalars.return_value.all.return_value = []
        else:
            result.scalars.return_value.all.return_value = []
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)

    written_texts = {}

    async def fake_save_text(path, text):
        written_texts[path] = text
        return path

    async def fake_copy(src, dst):
        written_texts[dst] = written_texts.get(src, "")

    async def fake_atomic_replace(src, dst):
        written_texts[dst] = written_texts.get(src, "")

    with patch("app.services.publish.storage") as mock_storage:
        mock_storage.get_url = AsyncMock(return_value="/storage/dummy.jpg")
        mock_storage.save_text = AsyncMock(side_effect=fake_save_text)
        mock_storage.copy = AsyncMock(side_effect=fake_copy)
        mock_storage.atomic_replace = AsyncMock(side_effect=fake_atomic_replace)

        run = await publish_catalogue(db, uuid.uuid4())

    assert run.status == "success"
    assert run.episode_count == 1  # two variants collapse to one

    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    episodes = catalogue["sections"][0]["shows"][0]["seasons"][0]["episodes"]
    assert len(episodes) == 1
    assert sorted(["en", "hi"]) == episodes[0]["languages"]


@pytest.mark.asyncio
async def test_season_0_marked_as_trailer():
    """Season 0 episodes are included in the catalogue but marked is_trailer_season=True."""
    show = _show()
    season0 = _season(show.id, number=0)
    trailer_ep = _episode(show.id, season0.id, title="Trailer", content_group="cg-trailer")

    call_count = [0]

    async def fake_execute(stmt):
        result = MagicMock()
        c = call_count[0]
        call_count[0] += 1
        mapping = [
            [show],             # 0: published shows
            [],                 # 1: show artwork
            [season0],          # 2: seasons
            [trailer_ep],       # 3: episodes for season 0
            [],                 # 4: trailer ep artwork
        ]
        result.scalars.return_value.all.return_value = mapping[c] if c < len(mapping) else []
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)

    written_texts = {}

    with patch("app.services.publish.storage") as mock_storage:
        mock_storage.get_url = AsyncMock(return_value="/storage/dummy.jpg")
        mock_storage.save_text = AsyncMock(side_effect=lambda p, t: written_texts.update({p: t}) or p)
        mock_storage.copy = AsyncMock()
        mock_storage.atomic_replace = AsyncMock()

        run = await publish_catalogue(db, uuid.uuid4())

    assert run.status == "success"
    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    season = catalogue["sections"][0]["shows"][0]["seasons"][0]
    assert season["season_number"] == 0
    assert season["is_trailer_season"] is True


@pytest.mark.asyncio
async def test_unpublished_episodes_excluded():
    """Draft episodes must not appear in the published catalogue."""
    show = _show()
    season = _season(show.id)
    draft_ep = _episode(show.id, season.id, status="draft", content_group="cg-draft")

    call_count = [0]

    async def fake_execute(stmt):
        result = MagicMock()
        c = call_count[0]
        call_count[0] += 1
        mapping = [[show], [], [season], []]  # empty episodes list (draft filtered by DB)
        result.scalars.return_value.all.return_value = mapping[c] if c < len(mapping) else []
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)

    written_texts = {}

    with patch("app.services.publish.storage") as mock_storage:
        mock_storage.get_url = AsyncMock(return_value="")
        mock_storage.save_text = AsyncMock(side_effect=lambda p, t: written_texts.update({p: t}) or p)
        mock_storage.copy = AsyncMock()
        mock_storage.atomic_replace = AsyncMock()

        run = await publish_catalogue(db, uuid.uuid4())

    assert run.episode_count == 0
    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    # Show with no episodes should not have seasons in the output
    sections = catalogue.get("sections", [])
    if sections:
        shows = sections[0].get("shows", [])
        if shows:
            seasons = shows[0].get("seasons", [])
            assert len(seasons) == 0


@pytest.mark.asyncio
async def test_show_without_section_skipped():
    """A published show without a section must be silently skipped during publish."""
    show_no_section = _show(section=None)
    show_ok = _show(title="Good Show", slug="good-show", section="series")
    season = _season(show_ok.id)
    ep = _episode(show_ok.id, season.id, content_group="cg-ok")

    call_count = [0]

    async def fake_execute(stmt):
        result = MagicMock()
        c = call_count[0]
        call_count[0] += 1
        mapping = [
            [show_no_section, show_ok],# 0: published shows
            [],                        # 1: show_ok artwork
            [season],                  # 2: seasons for show_ok
            [ep],                      # 3: episodes
            [],                        # 4: ep artwork
        ]
        result.scalars.return_value.all.return_value = mapping[c] if c < len(mapping) else []
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)

    written_texts = {}

    with patch("app.services.publish.storage") as mock_storage:
        mock_storage.get_url = AsyncMock(return_value="")
        mock_storage.save_text = AsyncMock(side_effect=lambda p, t: written_texts.update({p: t}) or p)
        mock_storage.copy = AsyncMock()
        mock_storage.atomic_replace = AsyncMock()

        run = await publish_catalogue(db, uuid.uuid4())

    assert run.show_count == 1  # only the good show
    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    all_titles = [s["title"] for sec in catalogue["sections"] for s in sec["shows"]]
    assert "Good Show" in all_titles
    assert show_no_section.title not in all_titles


@pytest.mark.asyncio
async def test_languages_sorted_deterministically():
    """Languages in a collapsed content_group entry must always be sorted."""
    show = _show()
    season = _season(show.id)
    ep_hi = _episode(show.id, season.id, language="hi", content_group="cg-lang", number=1)
    ep_en = _episode(show.id, season.id, language="en", content_group="cg-lang", number=1)

    call_count = [0]

    async def fake_execute(stmt):
        result = MagicMock()
        c = call_count[0]
        call_count[0] += 1
        # Hindi first — deterministic sort should still produce ["en", "hi"]
        mapping = [[show], [], [season], [ep_hi, ep_en], []]
        result.scalars.return_value.all.return_value = mapping[c] if c < len(mapping) else []
        return result

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(side_effect=fake_execute)

    written_texts = {}

    with patch("app.services.publish.storage") as mock_storage:
        mock_storage.get_url = AsyncMock(return_value="")
        mock_storage.save_text = AsyncMock(side_effect=lambda p, t: written_texts.update({p: t}) or p)
        mock_storage.copy = AsyncMock()
        mock_storage.atomic_replace = AsyncMock()

        await publish_catalogue(db, uuid.uuid4())

    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    langs = catalogue["sections"][0]["shows"][0]["seasons"][0]["episodes"][0]["languages"]
    assert langs == sorted(langs), "Languages must be sorted"
    assert langs == ["en", "hi"]
