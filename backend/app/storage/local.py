import os
import aiofiles
from app.config import settings
from app.storage.base import StorageBackend

class LocalStorageBackend(StorageBackend):
    def __init__(self):
        self.base_path = settings.storage_local_path
        os.makedirs(self.base_path, exist_ok=True)

    async def save(self, path: str, data: bytes) -> str:
        full_path = os.path.join(self.base_path, path.lstrip('/'))
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Atomic write: write to temp file then rename
        tmp_path = f"{full_path}.tmp"
        async with aiofiles.open(tmp_path, 'wb') as f:
            await f.write(data)
        
        os.rename(tmp_path, full_path)
        return path

    async def get(self, path: str) -> bytes:
        full_path = os.path.join(self.base_path, path.lstrip('/'))
        async with aiofiles.open(full_path, 'rb') as f:
            return await f.read()

    async def delete(self, path: str) -> None:
        full_path = os.path.join(self.base_path, path.lstrip('/'))
        if os.path.exists(full_path):
            os.remove(full_path)

    async def get_url(self, path: str) -> str:
        # Assuming we serve the storage directory via FastAPI StaticFiles at /storage
        return f"/storage/{path.lstrip('/')}"

storage = LocalStorageBackend()
