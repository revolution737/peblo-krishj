from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class CatalogResponse(BaseModel):
    published_at: Optional[str]
    version: Optional[str]
    sections: List[Dict[str, Any]]
