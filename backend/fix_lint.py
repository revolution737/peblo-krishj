import os

def replace_in_file(filepath, replacements):
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('app/config.py', [
    ('import os\nfrom pydantic_settings', 'from pydantic_settings')
])

replace_in_file('app/main.py', [
    ('except Exception:', 'except Exception as e:')
])

replace_in_file('app/models/__init__.py', [
    ('__all__ = ["Base", "User", "Show", "Season", "Episode", "Artwork", "PublishRun", "AuditLog"]', '__all__ = ["Artwork", "AuditLog", "Base", "Episode", "PublishRun", "Season", "Show", "User"]')
])

replace_in_file('app/models/audit_log.py', [
    ('from sqlalchemy import Column, String, DateTime, ForeignKey, Text', 'from sqlalchemy import Column, String, DateTime, ForeignKey')
])

replace_in_file('app/routers/admin.py', [
    ('from typing import List, Dict, Any\n', ''),
    ('from sqlalchemy.orm import selectinload\n', ''),
    ('detail=f"Rollback failed: {str(e)}"', 'detail=f"Rollback failed: {e!s}"')
])

replace_in_file('app/routers/artwork.py', [
    ('import os\n', ''),
    ('show_id: Optional[uuid.UUID] = Form(None)', 'show_id: uuid.UUID | None = Form(None)'),
    ('episode_id: Optional[uuid.UUID] = Form(None)', 'episode_id: uuid.UUID | None = Form(None)'),
    ('except Exception as e:', 'except Exception:'),
    ('    return None', '    return')
])

replace_in_file('app/routers/auth.py', [
    ('from app.schemas.auth import LoginRequest, Token', 'from app.schemas.auth import Token')
])

replace_in_file('app/routers/catalog.py', [
    ('from fastapi import APIRouter, Depends', 'from fastapi import APIRouter'),
    ('from sqlalchemy.ext.asyncio import AsyncSession\n', ''),
    ('from app.database import get_db\n', ''),
    ('q: Optional[str] = None', 'q: str | None = None'),
    ('category: Optional[str] = None', 'category: str | None = None'),
    ('language: Optional[str] = None', 'language: str | None = None'),
    ('section: Optional[str] = None', 'section: str | None = None')
])

replace_in_file('app/routers/episodes.py', [
    ('from typing import List, Optional\n', 'from typing import Optional\n'),
    ('List[EpisodeResponse]', 'list[EpisodeResponse]'),
    ('show_id: Optional[uuid.UUID] = None', 'show_id: uuid.UUID | None = None'),
    ('status: Optional[str] = None', 'status: str | None = None'),
    ('language: Optional[str] = None', 'language: str | None = None'),
    ('    if episode.status == "published":\n        if episode.duration_seconds is None:', '    if episode.status == "published" and episode.duration_seconds is None:')
])

replace_in_file('app/routers/seasons.py', [
    ('from typing import List, Optional\n', 'from typing import Optional\n'),
    ('List[SeasonResponse]', 'list[SeasonResponse]'),
    ('show_id: Optional[uuid.UUID] = Query(None)', 'show_id: uuid.UUID | None = Query(None)')
])

replace_in_file('app/routers/shows.py', [
    ('from typing import List, Optional\n', 'from typing import Optional\n'),
    ('List[ShowResponse]', 'list[ShowResponse]'),
    ('section: Optional[str] = None', 'section: str | None = None'),
    ('status: Optional[str] = None', 'status: str | None = None')
])

replace_in_file('app/schemas/catalog.py', [
    ('from typing import List, Dict, Any, Optional', 'from typing import Any, Optional'),
    ('published_at: Optional[str]', 'published_at: str | None'),
    ('version: Optional[str]', 'version: str | None'),
    ('sections: List[Dict[str, Any]]', 'sections: list[dict[str, Any]]')
])

replace_in_file('app/schemas/common.py', [
    ('import json\nimport os\nfrom pydantic import BaseModel, field_validator, ValidationInfo', 'from pydantic import BaseModel, field_validator'),
    ('from pydantic import BaseModel\nfrom typing import List, Optional', 'from typing import List, Optional'),
    ('section: Optional[str] = None', 'section: str | None = None'),
    ('categories: List[str] = []', 'categories: list[str] = []'),
    ('synopsis: Optional[str] = None', 'synopsis: str | None = None'),
    ('def validate_section(cls, v: Optional[str]) -> Optional[str]:', 'def validate_section(cls, v: str | None) -> str | None:'),
    ('duration_seconds: Optional[int] = None', 'duration_seconds: int | None = None'),
    ('original_episode_id: Optional[str] = None', 'original_episode_id: str | None = None')
])

replace_in_file('app/seed.py', [
    ('import sys\nimport uuid', 'import sys')
])

replace_in_file('app/services/audit.py', [
    ('target_id: Optional[str] = None', 'target_id: str | None = None'),
    ('details: Optional[dict] = None', 'details: dict | None = None')
])

replace_in_file('app/services/publish.py', [
    ('import json\nimport aiofiles\n', 'import json\n')
])

replace_in_file('app/storage/base.py', [
    ('        """Saves binary data to the given path and returns the final path."""\n        pass', '        """Saves binary data to the given path and returns the final path."""'),
    ('        """Retrieves data from the given path."""\n        pass', '        """Retrieves data from the given path."""'),
    ('        """Deletes the file at the given path."""\n        pass', '        """Deletes the file at the given path."""'),
    ('        """Gets a serving URL for the given path."""\n        pass', '        """Gets a serving URL for the given path."""'),
    ('        """Saves a UTF-8 text string to the given path and returns the final path."""\n        pass', '        """Saves a UTF-8 text string to the given path and returns the final path."""'),
    ('        """Copies a file from src_path to dst_path within the same backend."""\n        pass', '        """Copies a file from src_path to dst_path within the same backend."""'),
    ('        copy+delete on object stores that lack native rename)."""\n        pass', '        copy+delete on object stores that lack native rename)."""')
])

print("Fixes applied successfully.")
