from abc import ABC, abstractmethod

class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def save(self, path: str, data: bytes) -> str:
        """Saves binary data to the given path and returns the final path."""

    @abstractmethod
    async def get(self, path: str) -> bytes:
        """Retrieves data from the given path."""

    @abstractmethod
    async def delete(self, path: str) -> None:
        """Deletes the file at the given path."""

    @abstractmethod
    async def get_url(self, path: str) -> str:
        """Gets a serving URL for the given path."""

    @abstractmethod
    async def save_text(self, path: str, text: str) -> str:
        """Saves a UTF-8 text string to the given path and returns the final path."""

    @abstractmethod
    async def copy(self, src_path: str, dst_path: str) -> None:
        """Copies a file from src_path to dst_path within the same backend."""

    @abstractmethod
    async def atomic_replace(self, src_path: str, dst_path: str) -> None:
        """Atomically replaces dst_path with src_path (os.replace semantics on local disk,
        copy+delete on object stores that lack native rename)."""
