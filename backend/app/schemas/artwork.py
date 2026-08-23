from pydantic import BaseModel
import uuid

class ArtworkResponse(BaseModel):
    id: uuid.UUID
    artwork_type: str
    storage_path: str
    width_px: int
    height_px: int
    file_size_bytes: int

    class Config:
        from_attributes = True
