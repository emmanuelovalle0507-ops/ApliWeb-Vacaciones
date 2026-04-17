"""Pydantic schemas for announcements."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.pagination import PaginationMeta


class AnnouncementCreateIn(BaseModel):
    type: str = Field("GENERAL", description="GENERAL | URGENT | CELEBRATION")
    title: str = Field("", max_length=200)
    body: str = Field("", max_length=2000)
    image_url: str | None = None
    team_ids: list[str] = Field(default_factory=list, description="Target team IDs. Empty = broadcast.")
    is_pinned: bool = False
    expires_at: datetime | None = None
    publish_at: datetime | None = None
    requires_acknowledgment: bool = False
    attachment_url: str | None = None
    attachment_name: str | None = None
    target_user_ids: list[str] | None = None


class ReactionSummary(BaseModel):
    emoji: str
    count: int
    userNames: list[str] = Field(default_factory=list)


class AnnouncementOut(BaseModel):
    id: str
    author_id: str | None
    author_name: str | None
    type: str
    title: str
    body: str
    is_pinned: bool
    is_broadcast: bool
    team_ids: list[str]
    team_names: list[str]
    expires_at: datetime | None
    publish_at: datetime | None = None
    requires_acknowledgment: bool = False
    is_acknowledged: bool = False
    is_archived: bool = False
    status: str = "PUBLISHED"
    attachment_url: str | None = None
    attachment_name: str | None = None
    image_url: str | None = None
    is_read: bool = False
    read_count: int = 0
    comment_count: int = 0
    reactions: list[ReactionSummary] = Field(default_factory=list)
    my_reactions: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAnnouncementList(BaseModel):
    items: list[AnnouncementOut]
    unread_count: int = 0
    pagination: PaginationMeta


class AnnouncementReadUserOut(BaseModel):
    user_id: str
    full_name: str
    read_at: datetime | None = None


class AnnouncementReadStatsOut(BaseModel):
    announcement_id: str
    total_target_users: int
    read_count: int
    read_users: list[AnnouncementReadUserOut]
    unread_users: list[AnnouncementReadUserOut]


class CommentOut(BaseModel):
    id: str
    announcement_id: str
    user_id: str
    user_name: str | None
    body: str
    created_at: datetime


class CommentCreateIn(BaseModel):
    body: str = Field(..., min_length=1, max_length=1000)


class ReactionIn(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=10)
