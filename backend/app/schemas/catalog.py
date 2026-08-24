from pydantic import BaseModel
from typing import Any

class CatalogResponse(BaseModel):
    published_at: str | None
    version: str | None
    sections: list[dict[str, Any]]
