from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from typing import Optional
from app.models.audit_log import AuditLog

async def log_audit_event(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    target_type: str,
    target_id: str | None = None,
    details: dict | None = None
):
    """
    Helper function to log an audit event to the database.
    Does not commit the transaction (caller must commit).
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details
    )
    db.add(log)
