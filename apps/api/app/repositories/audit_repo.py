from typing import Any
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


class AuditRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        self.db.flush()
        self.db.refresh(log)
        return log

    def log(
        self,
        *,
        actor_user_id: str | UUID | None,
        action: str,
        entity_type: str,
        entity_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> AuditLog:
        uid = UUID(str(actor_user_id)) if actor_user_id else None
        entry = AuditLog(
            actor_user_id=uid,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_=metadata or {},
        )
        return self.add(entry)

    def list_paginated(
        self,
        *,
        action: str | None = None,
        entity_type: str | None = None,
        actor_user_id: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[AuditLog], int]:
        base = select(AuditLog)
        if action:
            base = base.where(AuditLog.action == action)
        if entity_type:
            base = base.where(AuditLog.entity_type == entity_type)
        if actor_user_id:
            base = base.where(AuditLog.actor_user_id == actor_user_id)
        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        items = list(
            self.db.execute(
                base.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total
