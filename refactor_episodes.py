import sys
import re

with open('backend/app/routers/episodes.py', 'r') as f:
    content = f.read()

# Add import
import_statement = "from app.services.validation import validate_episode_publishable\n"
content = content.replace("from app.services.audit import log_audit_event", import_statement + "from app.services.audit import log_audit_event")

# Find update_episode and replace the validation logic
old_validation = """    if episode_update.status == "published":
        if episode_update.duration_seconds is None:
            raise HTTPException(status_code=400, detail="Episodes need a duration before they can be published.")
        
        # Check artwork
        artwork_res = await db.execute(select(Artwork).where(Artwork.episode_id == episode_id))
        artworks = artwork_res.scalars().all()
        types = [a.artwork_type for a in artworks]
        missing = [t for t in ['poster', 'banner', 'thumbnail'] if t not in types]
        if missing:
            raise HTTPException(status_code=400, detail=f"This episode is missing artwork: {', '.join(missing)}. Upload them before publishing.")"""

new_validation = """    if episode_update.status == "published":
        # Apply the update locally to db_episode first for validation
        for key, value in episode_update.model_dump().items():
            setattr(db_episode, key, value)
            
        errors = await validate_episode_publishable(db, db_episode)
        if errors:
            raise HTTPException(status_code=400, detail=errors[0])
    else:
        for key, value in episode_update.model_dump().items():
            setattr(db_episode, key, value)"""

# Wait, if I replace the top part, there's a loop at the bottom:
#     for key, value in episode_update.model_dump().items():
#         setattr(db_episode, key, value)
# If I do it in the `if` block, I need to remove the bottom loop.
# It's safer to use regex to replace the whole block up to the try/except.

old_block = r"""    if episode_update\.status == "published":.*?for key, value in episode_update\.model_dump\(\)\.items\(\):\n\s*setattr\(db_episode, key, value\)"""

new_block = """    for key, value in episode_update.model_dump().items():
        setattr(db_episode, key, value)
        
    if episode_update.status == "published":
        errors = await validate_episode_publishable(db, db_episode)
        if errors:
            raise HTTPException(status_code=400, detail=errors[0])"""

content = re.sub(old_block, new_block, content, flags=re.DOTALL)

with open('backend/app/routers/episodes.py', 'w') as f:
    f.write(content)

print("episodes.py refactored")
