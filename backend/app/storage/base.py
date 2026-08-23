from abc import ABC, abstractmethod

class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def save(self, path: str, data: bytes) -> str:
        """Saves data to the given path and returns the final path."""
        pass

    @abstractmethod
    async def get(self, path: str) -> bytes:
        """Retrieves data from the given path."""
        pass

    @abstractmethod
    async def delete(self, path: str) -> None:
        """Deletes the file at the given path."""
        pass

    @abstractmethod
    async def get_url(self, path: str) -> str:
        """Gets a serving URL for the given path."""
        pass
