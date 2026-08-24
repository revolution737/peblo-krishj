import sys
import re

with open('backend/app/routers/admin.py', 'r') as f:
    content = f.read()

# Add import
import_statement = "from app.services.validation import get_catalog_validation_report\n"
content = content.replace("from app.services.publish import publish_catalogue", import_statement + "from app.services.publish import publish_catalogue")

# Remove _collect_blocking_issues function
content = re.sub(r'async def _collect_blocking_issues\(db: AsyncSession\).*?(?=@router\.post\("/catalog/publish"\))', '', content, flags=re.DOTALL)

# Replace trigger_publish logic
old_trigger_publish = """@router.post("/catalog/publish")
async def trigger_publish(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    \"\"\"Server-side validation gate: block publish if any published show/episode
    has missing section, duration, or artwork.\"\"\"
    blocking = await _collect_blocking_issues(db)

    if blocking:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot publish: blocking issues must be resolved first.",
                "issues": [issue["message"] for issue in blocking],
            },
        )"""

new_trigger_publish = """@router.post("/catalog/publish")
async def trigger_publish(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    \"\"\"Server-side validation gate: block publish if any published show/episode
    has missing section, duration, or artwork.\"\"\"
    report = await get_catalog_validation_report(db)

    if report["summary"]["total_blocking_issues"] > 0:
        # Extract flat list of issue messages for the frontend
        issue_msgs = []
        for show_block in report["blocking_issues"]:
            for issue in show_block["issues"]:
                issue_msgs.append(f"{show_block['show']}: {issue['message']}")
                
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Cannot publish: blocking issues must be resolved first.",
                "issues": issue_msgs,
            },
        )"""
        
content = content.replace(old_trigger_publish, new_trigger_publish)


# Replace get_validation_report logic
old_get_validation = r'@router\.get\("/validation-report"\)\s*async def get_validation_report\(db: AsyncSession = Depends\(get_db\), user: dict = Depends\(require_editor\)\):.*'
new_get_validation = """@router.get("/validation-report")
async def get_validation_report(db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    return await get_catalog_validation_report(db)"""

content = re.sub(old_get_validation, new_get_validation, content, flags=re.DOTALL)


with open('backend/app/routers/admin.py', 'w') as f:
    f.write(content)

print("admin.py refactored")
