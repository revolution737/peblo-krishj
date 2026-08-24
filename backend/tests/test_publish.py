"""
Tests for the publish pipeline:
  - content_group collapsing (two language variants → one catalogue entry)
  - season 0 (trailers) are included with is_trailer_season=True
  - languages list is sorted deterministically
  - unpublished episodes are excluded
  - shows without a section are skipped

These tests use lightweight dataclass-style objects with relationship attributes
pre-populated, mirroring how SQLAlchemy's selectinload delivers them.  This
decouples the tests from query ordering (no more fragile call-count mocking).
"""
import pytest
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.publish import publish_catalogue


# ──────────────────────────────────────────────
# Helpers — build lightweight fake ORM objects
# with relationship attributes pre-populated.
# ──────────────────────────────────────────────

def _artwork(artwork_type="poster", storage_path="artwork/seed/dummy.jpg"):
    a = MagicMock()
    a.artwork_type = artwork_type
    a.storage_path = storage_path
    return a


def _episode(show_id, season_id, number=1, title="Ep Title", language="en",
             content_group="cg-1", status="published", duration=300, artwork=None):
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
    e.artwork_items = artwork or []
    return e


def _season(show_id, number=1, episodes=None):
    s = MagicMock()
    s.id = uuid.uuid4()
    s.show_id = show_id
    s.season_number = number
    s.episodes = episodes or []
    return s


def _show(title="Test Show", slug="test-show", section="series",
          status="published", seasons=None, artwork=None):
    s = MagicMock()
    s.id = uuid.uuid4()
    s.title = title
    s.slug = slug
    s.section = section
    s.synopsis = "A test show."
    s.categories = ["adventure"]
    s.status = status
    s.seasons = seasons or []
    s.artwork = artwork or []
    return s


def _make_db(shows):
    """Return an AsyncSession mock that returns the given shows list on
    the single selectinload query issued by publish_catalogue."""
    result_mock = MagicMock()
    scalars_mock = MagicMock()
    scalars_mock.unique.return_value.all.return_value = shows
    result_mock.scalars.return_value = scalars_mock

    db = MagicMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.execute = AsyncMock(return_value=result_mock)
    return db


def _patch_storage():
    """Return a context manager that patches the storage backend."""
    written_texts = {}

    async def fake_save_text(path, text):
        written_texts[path] = text
        return path

    async def fake_copy(src, dst):
        written_texts[dst] = written_texts.get(src, "")

    async def fake_atomic_replace(src, dst):
        written_texts[dst] = written_texts.get(src, "")

    mock_storage = MagicMock()
    mock_storage.get_url = AsyncMock(return_value="/storage/dummy.jpg")
    mock_storage.save_text = AsyncMock(side_effect=fake_save_text)
    mock_storage.copy = AsyncMock(side_effect=fake_copy)
    mock_storage.atomic_replace = AsyncMock(side_effect=fake_atomic_replace)

    return patch("app.services.publish.storage", mock_storage), written_texts


# ──────────────────────────────────────────────
# Unit tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_content_group_collapsing():
    """Two episodes sharing a content_group but different languages collapse into
    one catalogue entry with both languages in a sorted list."""
    show = _show()
    season = _season(show.id)
    ep_en = _episode(show.id, season.id, language="en", content_group="cg-1")
    ep_hi = _episode(show.id, season.id, language="hi", content_group="cg-1")
    season.episodes = [ep_en, ep_hi]
    show.seasons = [season]

    db = _make_db([show])
    storage_patch, written_texts = _patch_storage()

    with storage_patch:
        run = await publish_catalogue(db, uuid.uuid4())

    assert run.status == "success"
    assert run.episode_count == 1  # two variants collapse to one

    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    episodes = catalogue["sections"][0]["shows"][0]["seasons"][0]["episodes"]
    assert len(episodes) == 1
    assert episodes[0]["languages"] == ["en", "hi"]


@pytest.mark.asyncio
async def test_season_0_marked_as_trailer():
    """Season 0 episodes are included in the catalogue but marked is_trailer_season=True."""
    show = _show()
    season0 = _season(show.id, number=0)
    trailer_ep = _episode(show.id, season0.id, title="Trailer", content_group="cg-trailer")
    season0.episodes = [trailer_ep]
    show.seasons = [season0]

    db = _make_db([show])
    storage_patch, written_texts = _patch_storage()

    with storage_patch:
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
    season.episodes = [draft_ep]
    show.seasons = [season]

    db = _make_db([show])
    storage_patch, written_texts = _patch_storage()

    with storage_patch:
        run = await publish_catalogue(db, uuid.uuid4())

    assert run.episode_count == 0
    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    # Show with no published episodes → no seasons in output
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
    season.episodes = [ep]
    show_ok.seasons = [season]

    db = _make_db([show_no_section, show_ok])
    storage_patch, written_texts = _patch_storage()

    with storage_patch:
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
    # Hindi first — deterministic sort should still produce ["en", "hi"]
    ep_hi = _episode(show.id, season.id, language="hi", content_group="cg-lang", number=1)
    ep_en = _episode(show.id, season.id, language="en", content_group="cg-lang", number=1)
    season.episodes = [ep_hi, ep_en]
    show.seasons = [season]

    db = _make_db([show])
    storage_patch, written_texts = _patch_storage()

    with storage_patch:
        await publish_catalogue(db, uuid.uuid4())

    catalogue = json.loads(written_texts.get("catalogue.json", "{}"))
    langs = catalogue["sections"][0]["shows"][0]["seasons"][0]["episodes"][0]["languages"]
    assert langs == sorted(langs), "Languages must be sorted"
    assert langs == ["en", "hi"]
