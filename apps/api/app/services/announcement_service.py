"""Announcement service — business logic for team announcements."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select as sa_select
from sqlalchemy.orm import Session

from app.models.announcement import Announcement, AnnouncementStatus, AnnouncementType
from app.models.announcement_read import AnnouncementRead
from app.models.user import User, UserRole
from app.repositories.announcement_repo import AnnouncementRepository
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository

logger = logging.getLogger(__name__)


class AnnouncementService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = AnnouncementRepository(db)
        self.user_repo = UserRepository(db)
        self.team_repo = TeamRepository(db)

    # ── Create ────────────────────────────────────────────

    def create_announcement(
        self,
        author_id: str,
        title: str,
        body: str,
        team_ids: list[str],
        announcement_type: str = "GENERAL",
        is_pinned: bool = False,
        expires_at: datetime | None = None,
        publish_at: datetime | None = None,
        requires_acknowledgment: bool = False,
        attachment_url: str | None = None,
        attachment_name: str | None = None,
        image_url: str | None = None,
        target_user_ids: list[str] | None = None,
    ) -> Announcement:
        """Create a new announcement. Validates author permissions."""
        if not title.strip() and not body.strip() and not image_url:
            raise ValueError("An announcement must have at least a title, body, or image.")

        author = self.user_repo.get_by_id(author_id)
        if not author:
            raise ValueError("Author not found")

        ann_type = AnnouncementType(announcement_type)

        # Permission checks — managers can target multiple teams now
        if author.role == UserRole.MANAGER:
            if not author.team_id:
                raise PermissionError("Manager has no team assigned")
            if not team_ids:
                # No teams = broadcast, only HR/Admin
                raise PermissionError("Manager cannot create broadcast announcements")
        elif author.role in (UserRole.HR, UserRole.ADMIN):
            pass
        else:
            raise PermissionError("Only MANAGER, HR, and ADMIN can create announcements")

        is_broadcast = len(team_ids) == 0 and not target_user_ids

        # All roles publish directly (Manager limited to own team already checked above)
        status = AnnouncementStatus.PUBLISHED

        # Scheduled? Mark as DRAFT until publish_at
        if publish_at and publish_at > datetime.now(timezone.utc):
            status = AnnouncementStatus.DRAFT

        ann = self.repo.create(
            author_id=author_id,
            announcement_type=ann_type,
            title=title,
            body=body,
            team_ids=team_ids,
            is_pinned=is_pinned,
            is_broadcast=is_broadcast,
            expires_at=expires_at,
        )
        # Set extra fields
        ann.publish_at = publish_at
        ann.requires_acknowledgment = requires_acknowledgment
        ann.status = status
        ann.attachment_url = attachment_url
        ann.attachment_name = attachment_name
        ann.image_url = image_url
        self.db.flush()

        # Custom audience
        if target_user_ids:
            self.repo.add_target_users(str(ann.id), target_user_ids)

        return ann

    def create_welcome_announcement(
        self,
        new_user: User,
        created_by_id: str,
    ) -> Announcement | None:
        """Auto-create a NEW_EMPLOYEE announcement for the new user's team."""
        if not new_user.team_id:
            logger.info("Skipping welcome announcement — user %s has no team", new_user.id)
            return None

        team = self.team_repo.get_by_id(str(new_user.team_id))
        team_name = team.name if team else "el equipo"
        position_text = f" como {new_user.position}" if new_user.position else ""

        title = f"Nuevo integrante en {team_name}"
        body = (
            f"Se incorpora {new_user.full_name}{position_text} al equipo {team_name}. "
            f"¡Bienvenid{'a' if new_user.full_name.endswith('a') else 'o'}!"
        )

        return self.repo.create(
            author_id=created_by_id,
            announcement_type=AnnouncementType.NEW_EMPLOYEE,
            title=title,
            body=body,
            team_ids=[str(new_user.team_id)],
            is_pinned=False,
            is_broadcast=False,
            expires_at=None,
        )

    # ── Read ──────────────────────────────────────────────

    def _team_id_for_visibility(self, user: User) -> str | None:
        """HR and ADMIN only see broadcasts, not team-specific announcements."""
        if user.role in (UserRole.HR, UserRole.ADMIN):
            return None
        return str(user.team_id) if user.team_id else None

    def list_for_user(
        self,
        user_id: str,
        offset: int = 0,
        limit: int = 20,
        announcement_type: str | None = None,
        show_hidden: bool = False,
    ) -> tuple[list[dict], int, int]:
        """Returns (items_as_dicts, total, unread_count)."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        team_id = self._team_id_for_visibility(user)
        items, total = self.repo.list_for_user(user_id, team_id, offset, limit, announcement_type, show_hidden)
        unread = self.repo.count_unread_for_user(user_id, team_id)

        result = []
        for ann in items:
            is_read = self.repo.is_read_by_user(str(ann.id), user_id)
            read_count = self.repo.get_read_count(str(ann.id))
            result.append(self._to_dict(ann, is_read=is_read, read_count=read_count, user_id=user_id))

        return result, total, unread

    def list_pinned_for_user(self, user_id: str) -> list[dict]:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return []
        team_id = self._team_id_for_visibility(user)
        items = self.repo.list_pinned_for_user(user_id, team_id)
        return [
            self._to_dict(ann, is_read=self.repo.is_read_by_user(str(ann.id), user_id))
            for ann in items
        ]

    def get_unread_count(self, user_id: str) -> int:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return 0
        team_id = self._team_id_for_visibility(user)
        return self.repo.count_unread_for_user(user_id, team_id)

    # ── Read tracking ────────────────────────────────────

    def mark_read(self, announcement_id: str, user_id: str) -> bool:
        return self.repo.mark_read(announcement_id, user_id)

    def dismiss(self, announcement_id: str, user_id: str) -> bool:
        """Hide an announcement for a user."""
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        return self.repo.dismiss(announcement_id, user_id)

    def undismiss(self, announcement_id: str, user_id: str) -> bool:
        """Unhide an announcement for a user."""
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        return self.repo.undismiss(announcement_id, user_id)

    # ── Stats ─────────────────────────────────────────────

    def get_read_stats(self, announcement_id: str, requester_id: str) -> dict:
        """Get read statistics for an announcement. Only author, ADMIN, HR, MANAGER can view."""
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")

        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")

        # Permission: author, admin, hr, or manager of a target team
        is_author = str(ann.author_id) == requester_id
        is_privileged = requester.role in (UserRole.ADMIN, UserRole.HR, UserRole.MANAGER)
        if not is_author and not is_privileged:
            raise PermissionError("No permission to view stats")

        # Get all target users
        target_user_ids: set[str] = set()
        if ann.is_broadcast:
            all_users = self.user_repo.list_active()
            target_user_ids = {str(u.id) for u in all_users}
        else:
            for at in ann.teams:
                team_members = self.user_repo.list_by_team(str(at.team_id))
                target_user_ids.update(str(u.id) for u in team_members)

        read_user_ids = set(self.repo.get_read_user_ids(announcement_id))

        read_users = []
        unread_users = []

        for uid in target_user_ids:
            u = self.user_repo.get_by_id(uid)
            if not u:
                continue
            if uid in read_user_ids:
                # Get read_at
                read_record = self.db.execute(
                    sa_select(AnnouncementRead).where(
                        AnnouncementRead.announcement_id == announcement_id,
                        AnnouncementRead.user_id == uid,
                    )
                ).scalar_one_or_none()
                read_users.append({
                    "user_id": uid,
                    "full_name": u.full_name,
                    "read_at": read_record.read_at if read_record else None,
                })
            else:
                unread_users.append({
                    "user_id": uid,
                    "full_name": u.full_name,
                    "read_at": None,
                })

        return {
            "announcement_id": announcement_id,
            "total_target_users": len(target_user_ids),
            "read_count": len(read_users),
            "read_users": read_users,
            "unread_users": unread_users,
        }

    # ── Update ────────────────────────────────────────────

    def toggle_pin(self, announcement_id: str, requester_id: str) -> Announcement:
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")

        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")

        is_author = str(ann.author_id) == requester_id
        is_privileged = requester.role in (UserRole.ADMIN, UserRole.HR)
        if not is_author and not is_privileged:
            raise PermissionError("No permission to pin/unpin")

        result = self.repo.toggle_pin(announcement_id)
        if not result:
            raise ValueError("Announcement not found")
        return result

    # ── Delete ────────────────────────────────────────────

    def delete_announcement(self, announcement_id: str, requester_id: str) -> bool:
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")

        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")

        is_author = str(ann.author_id) == requester_id
        is_privileged = requester.role in (UserRole.ADMIN, UserRole.HR, UserRole.MANAGER)
        if not is_author and not is_privileged:
            raise PermissionError("Only the author, HR, Manager or Admin can delete announcements")

        return self.repo.delete(announcement_id)

    # ── Reactions ───────────────────────────────────────

    def toggle_reaction(self, announcement_id: str, user_id: str, emoji: str) -> dict:
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        added = self.repo.add_reaction(announcement_id, user_id, emoji)
        if not added:
            self.repo.remove_reaction(announcement_id, user_id, emoji)
        return {"reactions": self.repo.get_reactions_summary(announcement_id)}

    def get_reactions(self, announcement_id: str) -> list[dict]:
        return self.repo.get_reactions_summary(announcement_id)

    # ── Comments ────────────────────────────────────────

    def add_comment(self, announcement_id: str, user_id: str, body: str) -> dict:
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        comment = self.repo.add_comment(announcement_id, user_id, body)
        return {
            "id": str(comment.id),
            "announcement_id": announcement_id,
            "user_id": str(comment.user_id),
            "user_name": comment.user.full_name if comment.user else None,
            "body": comment.body,
            "created_at": comment.created_at.isoformat(),
        }

    def list_comments(self, announcement_id: str) -> list[dict]:
        comments = self.repo.list_comments(announcement_id)
        return [{
            "id": str(c.id),
            "announcement_id": str(c.announcement_id),
            "user_id": str(c.user_id),
            "user_name": c.user.full_name if c.user else None,
            "body": c.body,
            "created_at": c.created_at.isoformat(),
        } for c in comments]

    def delete_comment(self, comment_id: str, user_id: str) -> bool:
        return self.repo.delete_comment(comment_id, user_id)

    # ── Acknowledgment ──────────────────────────────────

    def acknowledge(self, announcement_id: str, user_id: str) -> bool:
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        if not ann.requires_acknowledgment:
            raise ValueError("This announcement does not require acknowledgment")
        return self.repo.acknowledge(announcement_id, user_id)

    # ── Archive ─────────────────────────────────────────

    def archive(self, announcement_id: str, requester_id: str) -> Announcement:
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")
        ann = self.repo.get_by_id(announcement_id)
        if not ann:
            raise ValueError("Announcement not found")
        is_author = str(ann.author_id) == requester_id
        is_privileged = requester.role in (UserRole.ADMIN, UserRole.HR)
        if not is_author and not is_privileged:
            raise PermissionError("No permission to archive")
        result = self.repo.archive(announcement_id)
        if not result:
            raise ValueError("Announcement not found")
        return result

    def unarchive(self, announcement_id: str, requester_id: str) -> Announcement:
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")
        is_privileged = requester.role in (UserRole.ADMIN, UserRole.HR)
        if not is_privileged:
            raise PermissionError("Only HR/Admin can unarchive")
        result = self.repo.unarchive(announcement_id)
        if not result:
            raise ValueError("Announcement not found")
        return result

    # ── Approval ────────────────────────────────────────

    def approve_announcement(self, announcement_id: str, approver_id: str) -> Announcement:
        approver = self.user_repo.get_by_id(approver_id)
        if not approver:
            raise ValueError("User not found")
        if approver.role not in (UserRole.HR, UserRole.ADMIN):
            raise PermissionError("Only HR/Admin can approve announcements")
        result = self.repo.approve(announcement_id, approver_id)
        if not result:
            raise ValueError("Announcement not found")
        return result

    def reject_announcement(self, announcement_id: str, rejector_id: str) -> bool:
        rejector = self.user_repo.get_by_id(rejector_id)
        if not rejector:
            raise ValueError("User not found")
        if rejector.role not in (UserRole.HR, UserRole.ADMIN):
            raise PermissionError("Only HR/Admin can reject announcements")
        return self.repo.reject_approval(announcement_id)

    def list_pending_approval(self, requester_id: str) -> list[dict]:
        requester = self.user_repo.get_by_id(requester_id)
        if not requester:
            raise ValueError("User not found")
        if requester.role not in (UserRole.HR, UserRole.ADMIN):
            raise PermissionError("Only HR/Admin can view pending approvals")
        items = self.repo.list_pending_approval()
        return [self._to_dict(ann) for ann in items]

    # ── New since (popup) ────────────────────────────────

    def list_new_since(self, user_id: str, since: datetime) -> list[dict]:
        """Return unread announcements created after *since* visible to the user."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return []
        team_id = str(user.team_id) if user.team_id else None
        items = self.repo.list_new_since_for_user(user_id, team_id, since)
        return [
            self._to_dict(
                ann,
                is_read=False,
                read_count=self.repo.get_read_count(str(ann.id)),
                user_id=user_id,
            )
            for ann in items
        ]

    # ── Search ──────────────────────────────────────────

    def search(self, query: str, user_id: str) -> list[dict]:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return []
        team_id = self._team_id_for_visibility(user)
        items = self.repo.search(query, user_id, team_id)
        return [
            self._to_dict(ann, is_read=self.repo.is_read_by_user(str(ann.id), user_id),
                          read_count=self.repo.get_read_count(str(ann.id)), user_id=user_id)
            for ann in items
        ]

    # ── Email notification (URGENT / broadcast) ─────────

    def send_announcement_email(self, ann: Announcement) -> None:
        try:
            from app.services.notification_service import NotificationService
            notif_service = NotificationService(self.db)

            target_users: list[User] = []
            if ann.is_broadcast:
                target_users = self.user_repo.list_active()
            else:
                for at in ann.teams:
                    target_users.extend(self.user_repo.list_by_team(str(at.team_id)))
                for tu in ann.target_users:
                    u = self.user_repo.get_by_id(str(tu.user_id))
                    if u and u not in target_users:
                        target_users.append(u)

            for u in target_users:
                try:
                    notif_service.create(
                        user_id=str(u.id),
                        title=f"Anuncio: {ann.title}",
                        body=ann.body[:200],
                        notification_type="ANNOUNCEMENT",
                    )
                except Exception:
                    logger.warning("Failed to notify user %s", u.id)
        except Exception:
            logger.warning("Email notification skipped for announcement %s", ann.id)

    # ── Helpers ─────────────────────────────────────────

    def _to_dict(self, ann: Announcement, is_read: bool = False, read_count: int = 0,
                 user_id: str | None = None) -> dict:
        d = {
            "id": str(ann.id),
            "author_id": str(ann.author_id) if ann.author_id else None,
            "author_name": ann.author.full_name if ann.author else None,
            "type": ann.type.value,
            "title": ann.title,
            "body": ann.body,
            "is_pinned": ann.is_pinned,
            "is_broadcast": ann.is_broadcast,
            "team_ids": [str(at.team_id) for at in ann.teams],
            "team_names": [at.team.name for at in ann.teams if at.team],
            "expires_at": ann.expires_at.isoformat() if ann.expires_at else None,
            "publish_at": ann.publish_at.isoformat() if ann.publish_at else None,
            "requires_acknowledgment": ann.requires_acknowledgment,
            "is_archived": ann.is_archived,
            "status": ann.status.value if ann.status else "PUBLISHED",
            "attachment_url": ann.attachment_url,
            "attachment_name": ann.attachment_name,
            "image_url": ann.image_url,
            "is_read": is_read,
            "read_count": read_count,
            "comment_count": self.repo.get_comment_count(str(ann.id)),
            "reactions": self.repo.get_reactions_summary(str(ann.id)),
            "created_at": ann.created_at.isoformat(),
            "updated_at": ann.updated_at.isoformat(),
        }
        if user_id:
            d["is_acknowledged"] = self.repo.is_acknowledged_by_user(str(ann.id), user_id)
            d["my_reactions"] = self.repo.get_user_reactions(str(ann.id), user_id)
        else:
            d["is_acknowledged"] = False
            d["my_reactions"] = []
        return d
