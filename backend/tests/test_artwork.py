import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.auth.dependencies import require_editor
import io
from PIL import Image
import uuid

# Mock authentication
app.dependency_overrides[require_editor] = lambda: {"id": str(uuid.uuid4()), "role": "editor"}

def create_test_image(width, height, format="JPEG"):
    img = Image.new("RGB", (width, height), color="red")
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()

@pytest.mark.asyncio
async def test_upload_artwork_wrong_ratio():
    # 1:1 ratio instead of 16:9 for banner
    img_bytes = create_test_image(1280, 1280)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/admin/artwork/upload",
            data={
                "artwork_type": "banner",
                "show_id": str(uuid.uuid4())
            },
            files={"file": ("test.jpg", img_bytes, "image/jpeg")}
        )
        
    assert response.status_code == 400
    assert "banners need to be 16:9 ratio" in response.json()["detail"]

@pytest.mark.asyncio
async def test_upload_artwork_too_large():
    # Large file > 200KB
    img_bytes = create_test_image(1280, 720) + b"0" * (200 * 1024 + 1)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/admin/artwork/upload",
            data={
                "artwork_type": "banner",
                "show_id": str(uuid.uuid4())
            },
            files={"file": ("test.jpg", img_bytes, "image/jpeg")}
        )
        
    assert response.status_code == 400
    assert "maximum is 200 KB" in response.json()["detail"]

@pytest.mark.asyncio
async def test_upload_artwork_wrong_type():
    # GIF instead of JPEG/PNG
    img_bytes = b"GIF89a..."
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/admin/artwork/upload",
            data={
                "artwork_type": "banner",
                "show_id": str(uuid.uuid4())
            },
            files={"file": ("test.gif", img_bytes, "image/gif")}
        )
        
    assert response.status_code == 400
    assert "Please upload a JPEG or PNG image" in response.json()["detail"]
