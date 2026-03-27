"""
Service for sending automatic reminders about stale pending vacation requests.
Designed to be called by a scheduled task (cron job, Celery beat, etc.).
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.repositories.user_repo import UserRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.services.notification_service import NotificationService


class ReminderService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.request_repo = VacationRequestRepository(db)
        self.user_repo = UserRepository(db)
        self.notif_service = NotificationService(db)

    def send_stale_request_reminders(self, older_than_days: int = 3) -> dict:
        """
        Find all PENDING requests older than `older_than_days` and send
        a reminder notification to the responsible manager.

        Returns a summary dict with counts.
        """
        stale = self.request_repo.list_stale_pending(older_than_days)

        sent = 0
        skipped = 0
        errors = 0

        for request in stale:
            if not request.manager_id:
                skipped += 1
                continue

            try:
                employee = self.user_repo.get_by_id(str(request.employee_id))
                employee_name = employee.full_name if employee else "Empleado"
                days_waiting = (datetime.now(timezone.utc) - request.created_at).days

                self.notif_service.notify_stale_reminder(
                    request_id=str(request.id),
                    employee_name=employee_name,
                    manager_id=str(request.manager_id),
                    start_date=request.start_date.strftime("%d/%m/%Y"),
                    end_date=request.end_date.strftime("%d/%m/%Y"),
                    days_waiting=days_waiting,
                )
                sent += 1
            except Exception:
                errors += 1

        self.db.commit()

        return {
            "total_stale": len(stale),
            "reminders_sent": sent,
            "skipped": skipped,
            "errors": errors,
            "older_than_days": older_than_days,
        }
