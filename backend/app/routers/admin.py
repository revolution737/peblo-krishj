from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.show import Show
from app.models.season import Season
from app.models.episode import Episode
from app.models.artwork import Artwork
from app.models.publish_run import PublishRun
from app.models.audit_log import AuditLog
from app.models.user import User
from app.auth.dependencies import require_editor, require_admin
from app.services.validation import get_catalog_validation_report
from app.services.publish import publish_catalogue
from app.services.audit import log_audit_event
from app.storage.local import storage
import os
import aiofiles
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/catalog/publish")
async def trigger_publish(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    """Server-side validation gate: block publish if any published show/episode
    has missing section, duration, or artwork."""
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
        )

    run = await publish_catalogue(db, user["id"])
    await log_audit_event(
        db,
        user_id=uuid.UUID(user["id"]),
        action="PUBLISH",
        target_type="CATALOG",
        target_id=str(run.id),
        details={"shows": run.show_count, "episodes": run.episode_count},
    )
    await db.commit()
    return {
        "status": run.status,
        "run_id": str(run.id),
        "shows": run.show_count,
        "episodes": run.episode_count,
    }


@router.get("/catalog/history")
async def get_publish_history(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    stmt = (
        select(PublishRun, User.email)
        .join(User, PublishRun.triggered_by == User.id)
        .where(PublishRun.status == "success")
        .order_by(PublishRun.completed_at.desc())
        .limit(20)
    )
    result = await db.execute(stmt)

    history = []
    for run, user_email in result.all():
        history.append({
            "id": str(run.id),
            "triggered_by_email": user_email,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "show_count": run.show_count,
            "episode_count": run.episode_count,
            "catalogue_path": run.catalogue_path,
        })
    return {"history": history}


@router.post("/catalog/rollback/{run_id}")
async def rollback_catalog(run_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    try:
        run_uuid = uuid.UUID(run_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run_id format")

    stmt = select(PublishRun).where(PublishRun.id == run_uuid, PublishRun.status == "success")
    result = await db.execute(stmt)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(status_code=404, detail="Publish run not found or was not successful")

    if not run.catalogue_path:
        raise HTTPException(status_code=400, detail="Historical catalogue path is missing")

    historical_path = os.path.join(storage.base_path, run.catalogue_path)
    if not os.path.exists(historical_path):
        raise HTTPException(status_code=404, detail="Historical catalogue file not found on disk")

    live_path = os.path.join(storage.base_path, "catalogue.json")
    tmp_path = os.path.join(storage.base_path, f"catalogue_rollback_{run.id}.json.tmp")

    try:
        async with aiofiles.open(historical_path, "r") as f:
            content = await f.read()

        async with aiofiles.open(tmp_path, "w") as f:
            await f.write(content)

        os.replace(tmp_path, live_path)
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Rollback failed: {e!s}")

    await log_audit_event(
        db, user_id=uuid.UUID(user["id"]), action="ROLLBACK",
        target_type="CATALOG", target_id=str(run.id),
    )
    await db.commit()
    return {"status": "success", "message": f"Rolled back to run {run_id}"}


@router.get("/audit-logs")
async def get_audit_logs(db: AsyncSession = Depends(get_db), user: dict = Depends(require_admin)):
    stmt = (
        select(AuditLog, User.email)
        .join(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)

    logs = []
    for log, user_email in result.all():
        logs.append({
            "id": str(log.id),
            "user_email": user_email,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return {"logs": logs}


@router.get("/validation-report")
async def get_validation_report(db: AsyncSession = Depends(get_db), user: dict = Depends(require_editor)):
    return await get_catalog_validation_report(db)