from datetime import datetime, timezone

from sqlalchemy import select, update, func, Select
from sqlalchemy.orm import Session

from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, notification: Notification) -> Notification:
        self.db.add(notification)
        self.db.flush()
        self.db.refresh(notification)
        return notification

    def list_by_user(self, user_id: str, limit: int = 50, unread_only: bool = False) -> list[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read == False)  # noqa: E712
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def list_by_user_paginated(
        self, user_id: str, *, offset: int = 0, limit: int = 20, unread_only: bool = False
    ) -> tuple[list[Notification], int]:
        base = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            base = base.where(Notification.is_read == False)  # noqa: E712
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(Notification.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        return self.db.execute(count_stmt).scalar_one()

    def count_unread(self, user_id: str) -> int:
        stmt = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        )
        return self.db.execute(stmt).scalar_one()

    def mark_read(self, notification_id: str, user_id: str) -> bool:
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount > 0

    def mark_all_read(self, user_id: str) -> int:
        stmt = (
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True)
        )
        result = self.db.execute(stmt)
        self.db.flush()
        return result.rowcount
