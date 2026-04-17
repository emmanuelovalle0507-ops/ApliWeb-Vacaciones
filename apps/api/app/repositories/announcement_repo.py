"""Repository for announcements CRUD and queries."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.announcement import Announcement, AnnouncementStatus, AnnouncementType
from app.models.announcement_comment import AnnouncementComment
from app.models.announcement_reaction import AnnouncementReaction
from app.models.announcement_read import AnnouncementRead
from app.models.announcement_target_user import AnnouncementTargetUser
from app.models.announcement_team import AnnouncementTeam

logger = logging.getLogger(__name__)


class AnnouncementRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Create ────────────────────────────────────────────

    def create(
        self,
        author_id: str,
        announcement_type: AnnouncementType,
        title: str,
        body: str,
        team_ids: list[str],
        is_pinned: bool = False,
        is_broadcast: bool = False,
        expires_at: datetime | None = None,
    ) -> Announcement:
        announcement = Announcement(
            author_id=author_id,
            type=announcement_type,
            title=title,
            body=body,
            is_pinned=is_pinned,
            is_broadcast=is_broadcast,
            expires_at=expires_at,
        )
        self.db.add(announcement)
        self.db.flush()

        for tid in team_ids:
            self.db.add(AnnouncementTeam(announcement_id=announcement.id, team_id=tid))
        self.db.flush()

        return announcement

    # ── Read ──────────────────────────────────────────────

    def get_by_id(self, announcement_id: str) -> Announcement | None:
        return (
            self.db.execute(
                select(Announcement)
                .options(joinedload(Announcement.teams), joinedload(Announcement.author))
                .where(Announcement.id == announcement_id)
            )
            .unique()
            .scalar_one_or_none()
        )

    def list_for_user(
        self,
        user_id: str,
        user_team_id: str | None,
        offset: int = 0,
        limit: int = 20,
        announcement_type: str | None = None,
        show_hidden: bool = False,
    ) -> tuple[list[Announcement], int]:
        """List announcements visible to a user (their team + broadcasts), excluding expired."""
        now = datetime.now(timezone.utc)

        base_filter = or_(
            Announcement.expires_at.is_(None),
            Announcement.expires_at > now,
        )

        if user_team_id:
            visibility_filter = or_(
                Announcement.is_broadcast.is_(True),
                Announcement.teams.any(AnnouncementTeam.team_id == user_team_id),
            )
        else:
            visibility_filter = Announcement.is_broadcast.is_(True)

        # Only published + not archived + publish_at in the past or null
        published_filter = Announcement.status == AnnouncementStatus.PUBLISHED
        not_archived = Announcement.is_archived.is_(False)
        schedule_filter = or_(
            Announcement.publish_at.is_(None),
            Announcement.publish_at <= now,
        )

        conditions = [base_filter, visibility_filter, published_filter, not_archived, schedule_filter]

        if announcement_type:
            conditions.append(Announcement.type == AnnouncementType(announcement_type))

        dismissed_subq = (
            select(AnnouncementRead.announcement_id)
            .where(AnnouncementRead.user_id == user_id, AnnouncementRead.is_dismissed.is_(True))
            .scalar_subquery()
        )
        if show_hidden:
            conditions.append(Announcement.id.in_(dismissed_subq))
        else:
            conditions.append(Announcement.id.notin_(dismissed_subq))

        # Count
        count_q = select(func.count(Announcement.id)).where(*conditions)
        total = self.db.execute(count_q).scalar() or 0

        # Items
        items_q = (
            select(Announcement)
            .options(joinedload(Announcement.teams), joinedload(Announcement.author))
            .where(*conditions)
            .order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = self.db.execute(items_q).unique().scalars().all()

        return list(items), total

    def list_pinned_for_user(self, user_id: str, user_team_id: str | None) -> list[Announcement]:
        """List only pinned, non-expired announcements visible to a user."""
        now = datetime.now(timezone.utc)

        base_filter = or_(
            Announcement.expires_at.is_(None),
            Announcement.expires_at > now,
        )

        if user_team_id:
            visibility_filter = or_(
                Announcement.is_broadcast.is_(True),
                Announcement.teams.any(AnnouncementTeam.team_id == user_team_id),
            )
        else:
            visibility_filter = Announcement.is_broadcast.is_(True)

        dismissed_subq = (
            select(AnnouncementRead.announcement_id)
            .where(AnnouncementRead.user_id == user_id, AnnouncementRead.is_dismissed.is_(True))
            .scalar_subquery()
        )

        q = (
            select(Announcement)
            .options(joinedload(Announcement.teams), joinedload(Announcement.author))
            .where(base_filter, visibility_filter, Announcement.is_pinned.is_(True), Announcement.id.notin_(dismissed_subq))
            .order_by(Announcement.created_at.desc())
        )
        return list(self.db.execute(q).unique().scalars().all())

    # ── Read tracking ────────────────────────────────────

    def mark_read(self, announcement_id: str, user_id: str) -> bool:
        existing = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        if existing:
            return False
        self.db.add(AnnouncementRead(announcement_id=announcement_id, user_id=user_id))
        self.db.flush()
        return True

    def count_unread_for_user(self, user_id: str, user_team_id: str | None) -> int:
        """Count announcements visible to user that they haven't read."""
        now = datetime.now(timezone.utc)

        base_filter = or_(
            Announcement.expires_at.is_(None),
            Announcement.expires_at > now,
        )

        if user_team_id:
            visibility_filter = or_(
                Announcement.is_broadcast.is_(True),
                Announcement.teams.any(AnnouncementTeam.team_id == user_team_id),
            )
        else:
            visibility_filter = Announcement.is_broadcast.is_(True)

        read_subq = (
            select(AnnouncementRead.announcement_id)
            .where(AnnouncementRead.user_id == user_id)
            .scalar_subquery()
        )

        q = select(func.count(Announcement.id)).where(
            base_filter,
            visibility_filter,
            Announcement.id.notin_(read_subq),
        )
        return self.db.execute(q).scalar() or 0

    def is_read_by_user(self, announcement_id: str, user_id: str) -> bool:
        return (
            self.db.execute(
                select(AnnouncementRead).where(
                    AnnouncementRead.announcement_id == announcement_id,
                    AnnouncementRead.user_id == user_id,
                )
            ).scalar_one_or_none()
            is not None
        )

    def get_read_user_ids(self, announcement_id: str) -> list[str]:
        rows = self.db.execute(
            select(AnnouncementRead.user_id).where(
                AnnouncementRead.announcement_id == announcement_id
            )
        ).scalars().all()
        return [str(uid) for uid in rows]

    def get_read_count(self, announcement_id: str) -> int:
        return (
            self.db.execute(
                select(func.count(AnnouncementRead.id)).where(
                    AnnouncementRead.announcement_id == announcement_id
                )
            ).scalar()
            or 0
        )

    def dismiss(self, announcement_id: str, user_id: str) -> bool:
        """Hide an announcement for a user."""
        existing = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        if existing:
            if existing.is_dismissed:
                return False
            existing.is_dismissed = True
            self.db.flush()
            return True
        self.db.add(AnnouncementRead(
            announcement_id=announcement_id, user_id=user_id, is_dismissed=True
        ))
        self.db.flush()
        return True

    def undismiss(self, announcement_id: str, user_id: str) -> bool:
        """Unhide an announcement for a user."""
        existing = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not existing or not existing.is_dismissed:
            return False
        existing.is_dismissed = False
        self.db.flush()
        return True

    def is_dismissed_by_user(self, announcement_id: str, user_id: str) -> bool:
        row = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        return bool(row and row.is_dismissed)

    # ── Update ────────────────────────────────────────────

    def toggle_pin(self, announcement_id: str) -> Announcement | None:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return None
        ann.is_pinned = not ann.is_pinned
        self.db.flush()
        return ann

    # ── Archive ───────────────────────────────────────────

    def archive(self, announcement_id: str) -> Announcement | None:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return None
        ann.is_archived = True
        ann.status = AnnouncementStatus.ARCHIVED
        self.db.flush()
        return ann

    def unarchive(self, announcement_id: str) -> Announcement | None:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return None
        ann.is_archived = False
        ann.status = AnnouncementStatus.PUBLISHED
        self.db.flush()
        return ann

    # ── Approval ──────────────────────────────────────────

    def approve(self, announcement_id: str, approver_id: str) -> Announcement | None:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return None
        ann.status = AnnouncementStatus.PUBLISHED
        ann.approved_by_id = approver_id
        ann.approved_at = datetime.now(timezone.utc)
        self.db.flush()
        return ann

    def reject_approval(self, announcement_id: str) -> bool:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return False
        self.db.delete(ann)
        self.db.flush()
        return True

    def list_pending_approval(self) -> list[Announcement]:
        q = (
            select(Announcement)
            .options(joinedload(Announcement.teams), joinedload(Announcement.author))
            .where(Announcement.status == AnnouncementStatus.PENDING_APPROVAL)
            .order_by(Announcement.created_at.desc())
        )
        return list(self.db.execute(q).unique().scalars().all())

    # ── Acknowledgment ────────────────────────────────────

    def acknowledge(self, announcement_id: str, user_id: str) -> bool:
        existing = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        if existing:
            if existing.is_acknowledged:
                return False
            existing.is_acknowledged = True
            self.db.flush()
            return True
        self.db.add(AnnouncementRead(
            announcement_id=announcement_id, user_id=user_id, is_acknowledged=True
        ))
        self.db.flush()
        return True

    def get_acknowledgment_count(self, announcement_id: str) -> int:
        return (
            self.db.execute(
                select(func.count(AnnouncementRead.id)).where(
                    AnnouncementRead.announcement_id == announcement_id,
                    AnnouncementRead.is_acknowledged.is_(True),
                )
            ).scalar() or 0
        )

    def is_acknowledged_by_user(self, announcement_id: str, user_id: str) -> bool:
        row = self.db.execute(
            select(AnnouncementRead).where(
                AnnouncementRead.announcement_id == announcement_id,
                AnnouncementRead.user_id == user_id,
            )
        ).scalar_one_or_none()
        return bool(row and row.is_acknowledged)

    # ── Reactions ─────────────────────────────────────────

    def add_reaction(self, announcement_id: str, user_id: str, emoji: str) -> bool:
        existing = self.db.execute(
            select(AnnouncementReaction).where(
                AnnouncementReaction.announcement_id == announcement_id,
                AnnouncementReaction.user_id == user_id,
                AnnouncementReaction.emoji == emoji,
            )
        ).scalar_one_or_none()
        if existing:
            return False
        self.db.add(AnnouncementReaction(
            announcement_id=announcement_id, user_id=user_id, emoji=emoji
        ))
        self.db.flush()
        return True

    def remove_reaction(self, announcement_id: str, user_id: str, emoji: str) -> bool:
        existing = self.db.execute(
            select(AnnouncementReaction).where(
                AnnouncementReaction.announcement_id == announcement_id,
                AnnouncementReaction.user_id == user_id,
                AnnouncementReaction.emoji == emoji,
            )
        ).scalar_one_or_none()
        if not existing:
            return False
        self.db.delete(existing)
        self.db.flush()
        return True

    def get_reactions_summary(self, announcement_id: str) -> list[dict]:
        """Returns [{emoji, count, user_names}] for an announcement."""
        rows = self.db.execute(
            select(AnnouncementReaction)
            .options(joinedload(AnnouncementReaction.user))
            .where(AnnouncementReaction.announcement_id == announcement_id)
        ).unique().scalars().all()
        summary: dict[str, list[str]] = {}
        for r in rows:
            summary.setdefault(r.emoji, []).append(r.user.full_name if r.user else "")
        return [{"emoji": e, "count": len(names), "userNames": names} for e, names in summary.items()]

    def get_user_reactions(self, announcement_id: str, user_id: str) -> list[str]:
        rows = self.db.execute(
            select(AnnouncementReaction.emoji).where(
                AnnouncementReaction.announcement_id == announcement_id,
                AnnouncementReaction.user_id == user_id,
            )
        ).scalars().all()
        return list(rows)

    # ── Comments ──────────────────────────────────────────

    def add_comment(self, announcement_id: str, user_id: str, body: str) -> AnnouncementComment:
        comment = AnnouncementComment(
            announcement_id=announcement_id, user_id=user_id, body=body
        )
        self.db.add(comment)
        self.db.flush()
        # reload with user joined
        return self.db.execute(
            select(AnnouncementComment)
            .options(joinedload(AnnouncementComment.user))
            .where(AnnouncementComment.id == comment.id)
        ).unique().scalar_one()

    def list_comments(self, announcement_id: str) -> list[AnnouncementComment]:
        q = (
            select(AnnouncementComment)
            .options(joinedload(AnnouncementComment.user))
            .where(AnnouncementComment.announcement_id == announcement_id)
            .order_by(AnnouncementComment.created_at.asc())
        )
        return list(self.db.execute(q).unique().scalars().all())

    def delete_comment(self, comment_id: str, user_id: str) -> bool:
        comment = self.db.execute(
            select(AnnouncementComment).where(AnnouncementComment.id == comment_id)
        ).scalar_one_or_none()
        if not comment or str(comment.user_id) != user_id:
            return False
        self.db.delete(comment)
        self.db.flush()
        return True

    def get_comment_count(self, announcement_id: str) -> int:
        return (
            self.db.execute(
                select(func.count(AnnouncementComment.id)).where(
                    AnnouncementComment.announcement_id == announcement_id
                )
            ).scalar() or 0
        )

    # ── Target users ──────────────────────────────────────

    def add_target_users(self, announcement_id: str, user_ids: list[str]) -> None:
        for uid in user_ids:
            self.db.add(AnnouncementTargetUser(announcement_id=announcement_id, user_id=uid))
        self.db.flush()

    # ── Search ────────────────────────────────────────────

    def search(self, query: str, user_id: str, user_team_id: str | None, limit: int = 20) -> list[Announcement]:
        now = datetime.now(timezone.utc)
        base_filter = or_(Announcement.expires_at.is_(None), Announcement.expires_at > now)
        if user_team_id:
            vis = or_(
                Announcement.is_broadcast.is_(True),
                Announcement.teams.any(AnnouncementTeam.team_id == user_team_id),
            )
        else:
            vis = Announcement.is_broadcast.is_(True)
        search_filter = or_(
            Announcement.title.ilike(f"%{query}%"),
            Announcement.body.ilike(f"%{query}%"),
        )
        q = (
            select(Announcement)
            .options(joinedload(Announcement.teams), joinedload(Announcement.author))
            .where(base_filter, vis, search_filter,
                   Announcement.status == AnnouncementStatus.PUBLISHED,
                   Announcement.is_archived.is_(False))
            .order_by(Announcement.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(q).unique().scalars().all())

    # ── New since (for popup) ────────────────────────────

    def list_new_since_for_user(
        self,
        user_id: str,
        user_team_id: str | None,
        since: datetime,
    ) -> list[Announcement]:
        """Return unread announcements created after *since* that are visible to the user."""
        now = datetime.now(timezone.utc)

        base_filter = or_(Announcement.expires_at.is_(None), Announcement.expires_at > now)

        if user_team_id:
            visibility_filter = or_(
                Announcement.is_broadcast.is_(True),
                Announcement.teams.any(AnnouncementTeam.team_id == user_team_id),
            )
        else:
            visibility_filter = Announcement.is_broadcast.is_(True)

        published_filter = Announcement.status == AnnouncementStatus.PUBLISHED
        not_archived = Announcement.is_archived.is_(False)
        schedule_filter = or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now)
        created_after = Announcement.created_at > since

        read_subq = (
            select(AnnouncementRead.announcement_id)
            .where(AnnouncementRead.user_id == user_id)
            .scalar_subquery()
        )

        q = (
            select(Announcement)
            .options(joinedload(Announcement.teams), joinedload(Announcement.author))
            .where(
                base_filter, visibility_filter, published_filter, not_archived,
                schedule_filter, created_after, Announcement.id.notin_(read_subq),
            )
            .order_by(Announcement.created_at.asc())
        )
        return list(self.db.execute(q).unique().scalars().all())

    # ── Delete ────────────────────────────────────────────

    def delete(self, announcement_id: str) -> bool:
        ann = self.get_by_id(announcement_id)
        if not ann:
            return False
        self.db.delete(ann)
        self.db.flush()
        return True
