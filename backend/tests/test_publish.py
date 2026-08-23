import pytest
import os
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth.dependencies import require_admin
from unittest.mock import patch
from app.models.publish_run import PublishRun

# Mock authentication
app.dependency_overrides[require_admin] = lambda: {"id": str(uuid.uuid4()), "role": "admin"}

@pytest.mark.asyncio
async def test_publish_catalog_success():
    # We will patch the service to avoid needing a fully seeded DB for the publish test
    # This allows us to test the router and its response format.
    
    fake_run = PublishRun(
        id=uuid.uuid4(),
        status="success",
        show_count=5,
        episode_count=20
    )
    
    with patch("app.routers.admin.publish_catalogue", return_value=fake_run) as mock_publish:
        with patch("app.routers.admin.log_audit_event") as mock_audit:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.post("/admin/catalog/publish")
                
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert "run_id" in data
            assert data["shows"] == 5
            assert data["episodes"] == 20
            
            mock_publish.assert_called_once()
            mock_audit.assert_called_once()
