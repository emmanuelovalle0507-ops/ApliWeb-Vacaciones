"""Notification service — creates in-app notifications and sends emails."""

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.notification import EmailStatus, Notification, NotificationType
from app.models.user import User
from app.repositories.notification_repo import NotificationRepository
from app.repositories.user_repo import UserRepository
from app.services.email_service import send_email

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notif_repo = NotificationRepository(db)
        self.user_repo = UserRepository(db)

    # ── helpers ──────────────────────────────────────────
    def _get_user(self, user_id: str) -> User | None:
        return self.user_repo.get_by_id(user_id)

    def _app_url(self, path: str = "/") -> str:
        return f"{settings.app_frontend_url}{path}"

    def _create_and_send(
        self,
        user_id: str,
        notif_type: NotificationType,
        title: str,
        body: str,
        entity_type: str | None = None,
        entity_id: str | None = None,
        action_url: str | None = None,
    ) -> Notification:
        user = self._get_user(user_id)
        email_to = user.email if user else None

        email_status = EmailStatus.SKIPPED
        email_sent_at = None

        if email_to and settings.smtp_enabled:
            email_status = EmailStatus.PENDING
            sent = send_email(
                to_email=email_to,
                subject=f"[Vacaciones] {title}",
                title=title,
                body=body,
                action_url=action_url,
            )
            if sent:
                email_status = EmailStatus.SENT
                email_sent_at = datetime.now(timezone.utc)
            else:
                email_status = EmailStatus.FAILED
        elif email_to:
            logger.info("[NOTIF] Email skipped (SMTP disabled). User: %s | Title: %s", user_id, title)

        notif = Notification(
            user_id=user.id if user else user_id,
            type=notif_type,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            is_read=False,
            email_status=email_status,
            email_to=email_to,
            email_sent_at=email_sent_at,
        )
        return self.notif_repo.add(notif)

    # ── public API ───────────────────────────────────────

    def notify_request_created(self, request_id: str, employee_name: str, manager_id: str, start_date: str, end_date: str, days: float) -> Notification:
        """Notify manager that an employee created a new request."""
        return self._create_and_send(
            user_id=manager_id,
            notif_type=NotificationType.REQUEST_CREATED,
            title="Nueva solicitud de vacaciones",
            body=(
                f"{employee_name} ha solicitado vacaciones del {start_date} al {end_date} "
                f"({days} días hábiles). Revísala y toma una decisión."
            ),
            entity_type="vacation_request",
            entity_id=request_id,
            action_url=self._app_url("/manager/dashboard"),
        )

    def notify_request_approved(self, request_id: str, employee_id: str, manager_name: str, start_date: str, end_date: str, days: float) -> Notification:
        """Notify employee that their request was approved."""
        return self._create_and_send(
            user_id=employee_id,
            notif_type=NotificationType.REQUEST_APPROVED,
            title="Solicitud de vacaciones aprobada ✓",
            body=(
                f"Tu solicitud del {start_date} al {end_date} ({days} días) "
                f"fue aprobada por {manager_name}. ¡Disfruta tu descanso!"
            ),
            entity_type="vacation_request",
            entity_id=request_id,
            action_url=self._app_url("/employee/dashboard"),
        )

    def notify_request_rejected(self, request_id: str, employee_id: str, manager_name: str, start_date: str, end_date: str, comment: str | None) -> Notification:
        """Notify employee that their request was rejected."""
        reason_text = f" Comentario: \"{comment}\"" if comment else ""
        return self._create_and_send(
            user_id=employee_id,
            notif_type=NotificationType.REQUEST_REJECTED,
            title="Solicitud de vacaciones rechazada",
            body=(
                f"Tu solicitud del {start_date} al {end_date} "
                f"fue rechazada por {manager_name}.{reason_text}"
            ),
            entity_type="vacation_request",
            entity_id=request_id,
            action_url=self._app_url("/employee/dashboard"),
        )

    def notify_request_cancelled(self, request_id: str, employee_name: str, manager_id: str, start_date: str, end_date: str) -> Notification:
        """Notify manager that an employee cancelled a pending request."""
        return self._create_and_send(
            user_id=manager_id,
            notif_type=NotificationType.REQUEST_CANCELLED,
            title="Solicitud cancelada",
            body=(
                f"{employee_name} canceló su solicitud de vacaciones del "
                f"{start_date} al {end_date}."
            ),
            entity_type="vacation_request",
            entity_id=request_id,
            action_url=self._app_url("/manager/dashboard"),
        )

    def notify_policy_updated(self, team_member_ids: list[str], updater_name: str, max_off: int, min_notice: int) -> list[Notification]:
        """Notify all team members about a policy update."""
        results = []
        for uid in team_member_ids:
            notif = self._create_and_send(
                user_id=uid,
                notif_type=NotificationType.POLICY_UPDATED,
                title="Política de equipo actualizada",
                body=(
                    f"{updater_name} actualizó la política del equipo: "
                    f"máximo {max_off} personas fuera por día, "
                    f"mínimo {min_notice} días de anticipación."
                ),
                entity_type="team_policy",
            )
            results.append(notif)
        return results

    # ── queries ──────────────────────────────────────────

    def list_for_user(self, user_id: str, limit: int = 50, unread_only: bool = False) -> list[Notification]:
        return self.notif_repo.list_by_user(user_id, limit=limit, unread_only=unread_only)

    def count_unread(self, user_id: str) -> int:
        return self.notif_repo.count_unread(user_id)

    def mark_read(self, notification_id: str, user_id: str) -> bool:
        return self.notif_repo.mark_read(notification_id, user_id)

    def mark_all_read(self, user_id: str) -> int:
        return self.notif_repo.mark_all_read(user_id)
