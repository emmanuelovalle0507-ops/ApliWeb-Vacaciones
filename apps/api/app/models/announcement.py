"""Announcement model — team-scoped announcements and news feed."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class AnnouncementType(str, Enum):
    GENERAL = "GENERAL"
    URGENT = "URGENT"
    CELEBRATION = "CELEBRATION"
    NEW_EMPLOYEE = "NEW_EMPLOYEE"


class AnnouncementStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    type: Mapped[AnnouncementType] = mapped_column(
        SQLEnum(AnnouncementType, name="announcement_type"),
        nullable=False,
        default=AnnouncementType.GENERAL,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_broadcast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    publish_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    requires_acknowledgment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[AnnouncementStatus] = mapped_column(
        SQLEnum(AnnouncementStatus, name="announcement_status"),
        nullable=False,
        default=AnnouncementStatus.PUBLISHED,
    )
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    attachment_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    teams = relationship("AnnouncementTeam", back_populates="announcement", cascade="all, delete-orphan")
    reads = relationship("AnnouncementRead", back_populates="announcement", cascade="all, delete-orphan")
    reactions = relationship("AnnouncementReaction", back_populates="announcement", cascade="all, delete-orphan")
    comments = relationship("AnnouncementComment", back_populates="announcement", cascade="all, delete-orphan")
    target_users = relationship("AnnouncementTargetUser", back_populates="announcement", cascade="all, delete-orphan")
    author = relationship("User", foreign_keys=[author_id], lazy="joined")
    approved_by = relationship("User", foreign_keys=[approved_by_id], lazy="joined")
