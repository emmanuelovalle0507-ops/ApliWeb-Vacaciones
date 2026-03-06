from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.pagination import PaginationMeta


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    entity_type: str | None = None
    entity_id: str | None = None
    is_read: bool
    email_status: str
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut] = Field(default_factory=list)
    unread_count: int = 0


class PaginatedNotificationList(BaseModel):
    items: list[NotificationOut] = Field(default_factory=list)
    unread_count: int = 0
    pagination: PaginationMeta


class NotificationCountOut(BaseModel):
    unread_count: int


class MarkAllReadOut(BaseModel):
    marked_count: int
