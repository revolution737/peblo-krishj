from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from sqlalchemy import select
from PIL import Image
import io
import uuid
import os

from app.database import get_db
from app.models.artwork import Artwork
from app.schemas.artwork import ArtworkResponse
from app.auth.dependencies import require_editor
from app.storage.local import storage
from app.services.audit import log_audit_event

router = APIRouter(prefix="/admin/artwork", tags=["admin/artwork"])

MAX_FILE_SIZE = 200 * 1024 # 200 KB

@router.post("/upload", response_model=ArtworkResponse)
async def upload_artwork(
    file: UploadFile = File(...),
    artwork_type: str = Form(...),
    show_id: Optional[uuid.UUID] = Form(None),
    episode_id: Optional[uuid.UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_editor)
):
    if artwork_type not in ('poster', 'banner', 'thumbnail'):
        raise HTTPException(status_code=400, detail="Invalid artwork_type. Must be poster, banner, or thumbnail.")
        
    if (show_id is None and episode_id is None) or (show_id is not None and episode_id is not None):
        raise HTTPException(status_code=400, detail="Must provide exactly one of show_id or episode_id.")

    # 1. File Type Check (Server-side validation)
    content_type = file.content_type
    if content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(
            status_code=400, 
            detail=f"Please upload a JPEG or PNG image. You uploaded a {content_type} file."
        )

    # 2. File Size Check (200 KB max)
    file_bytes = await file.read()
    file_size = len(file_bytes)
    if file_size > MAX_FILE_SIZE:
        kb_size = file_size // 1024
        raise HTTPException(
            status_code=400, 
            detail=f"This image is {kb_size} KB, but the maximum is 200 KB. Try compressing it or reducing the quality."
        )

    # 3. Image Dimensions and Aspect Ratio Check (Pillow)
    try:
        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size
    except Exception as e:
        raise HTTPException(status_code=400, detail="The file is not a valid image.")

    ratio = width / height
    
    if artwork_type == 'poster':
        # Target 600x900 (2:3 = 0.666...)
        expected_ratio = 2 / 3
        if not (expected_ratio * 0.98 <= ratio <= expected_ratio * 1.02):
            raise HTTPException(
                status_code=400, 
                detail=f"This poster image is {width}x{height} ({ratio:.2f} ratio), but posters need to be 2:3 ratio (like 600x900). Please crop or resize it."
            )
        if width < 600 * 0.8 or height < 900 * 0.8:
            raise HTTPException(status_code=400, detail=f"This poster is {width}x{height}, which is too small. Posters should be around 600x900 pixels.")

    elif artwork_type == 'banner':
        # Target 1280x720 (16:9 = 1.777...)
        expected_ratio = 16 / 9
        if not (expected_ratio * 0.98 <= ratio <= expected_ratio * 1.02):
            raise HTTPException(
                status_code=400, 
                detail=f"This banner image is {width}x{height} ({ratio:.2f} ratio), but banners need to be 16:9 ratio (like 1280x720). Please crop or resize it."
            )
        if width < 1280 * 0.8 or height < 720 * 0.8:
            raise HTTPException(status_code=400, detail=f"This banner is {width}x{height}, which is too small. Banners should be around 1280x720 pixels.")
            
    elif artwork_type == 'thumbnail':
        # Target 640x360 (16:9 = 1.777...)
        expected_ratio = 16 / 9
        if not (expected_ratio * 0.98 <= ratio <= expected_ratio * 1.02):
            raise HTTPException(
                status_code=400, 
                detail=f"This thumbnail image is {width}x{height} ({ratio:.2f} ratio), but thumbnails need to be 16:9 ratio (like 640x360). Please crop or resize it."
            )
        if width < 640 * 0.8 or height < 360 * 0.8:
            raise HTTPException(status_code=400, detail=f"This thumbnail is {width}x{height}, which is too small. Thumbnails should be around 640x360 pixels.")

    # Save via storage backend
    extension = "jpg" if content_type == "image/jpeg" else "png"
    filename = f"{uuid.uuid4()}.{extension}"
    # Group by show_id or episode_id in storage path
    target_id = show_id if show_id else episode_id
    storage_path = f"artwork/{target_id}/{artwork_type}_{filename}"
    
    await storage.save(storage_path, file_bytes)
    
    # Store in DB, update if exists via upsert logic or just manual replace
    # Check if exists
    if show_id:
        stmt = select(Artwork).where(Artwork.show_id == show_id, Artwork.artwork_type == artwork_type)
    else:
        stmt = select(Artwork).where(Artwork.episode_id == episode_id, Artwork.artwork_type == artwork_type)
        
    result = await db.execute(stmt)
    existing_artwork = result.scalar_one_or_none()

    if existing_artwork:
        # Delete old file
        await storage.delete(existing_artwork.storage_path)
        existing_artwork.storage_path = storage_path
        existing_artwork.width_px = width
        existing_artwork.height_px = height
        existing_artwork.file_size_bytes = file_size
        existing_artwork.original_filename = file.filename
        db.add(existing_artwork)
        artwork_record = existing_artwork
    else:
        artwork_record = Artwork(
            show_id=show_id,
            episode_id=episode_id,
            artwork_type=artwork_type,
            storage_path=storage_path,
            original_filename=file.filename,
            width_px=width,
            height_px=height,
            file_size_bytes=file_size
        )
        db.add(artwork_record)
        
    await db.flush()
    await log_audit_event(
        db, 
        user_id=uuid.UUID(user["id"]), 
        action="UPLOAD", 
        target_type="ARTWORK", 
        target_id=str(artwork_record.id), 
        details={"type": artwork_type, "filename": file.filename}
    )
    await db.commit()
    await db.refresh(artwork_record)
    
    # Prepend the /storage prefix to the path for the response so the frontend can render it easily
    # Or just return raw path and let frontend construct it. We will return raw path and frontend can construct it.
    
    return artwork_record
