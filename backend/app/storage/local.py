import os
import shutil
import aiofiles
from app.config import settings
from app.storage.base import StorageBackend

class LocalStorageBackend(StorageBackend):
    def __init__(self):
        self.base_path = settings.storage_local_path
        os.makedirs(self.base_path, exist_ok=True)

    def _full(self, path: str) -> str:
        return os.path.join(self.base_path, path.lstrip('/'))

    async def save(self, path: str, data: bytes) -> str:
        full_path = self._full(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        # Atomic write: write to temp file then rename
        tmp_path = f"{full_path}.tmp"
        async with aiofiles.open(tmp_path, 'wb') as f:
            await f.write(data)
        os.rename(tmp_path, full_path)
        return path

    async def save_text(self, path: str, text: str) -> str:
        full_path = self._full(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        tmp_path = f"{full_path}.tmp"
        async with aiofiles.open(tmp_path, 'w', encoding='utf-8') as f:
            await f.write(text)
        os.rename(tmp_path, full_path)
        return path

    async def copy(self, src_path: str, dst_path: str) -> None:
        shutil.copy2(self._full(src_path), self._full(dst_path))

    async def atomic_replace(self, src_path: str, dst_path: str) -> None:
        """POSIX os.replace is atomic on the same filesystem partition."""
        os.replace(self._full(src_path), self._full(dst_path))

    async def get(self, path: str) -> bytes:
        async with aiofiles.open(self._full(path), 'rb') as f:
            return await f.read()

    async def delete(self, path: str) -> None:
        full_path = self._full(path)
        if os.path.exists(full_path):
            os.remove(full_path)

    async def get_url(self, path: str) -> str:
        # Served by FastAPI StaticFiles at /storage
        return f"/storage/{path.lstrip('/')}"

storage = LocalStorageBackend()
