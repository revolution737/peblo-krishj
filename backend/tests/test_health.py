import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    # Even if DB is disconnected, it should return 503 or 200 with status JSON.
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
