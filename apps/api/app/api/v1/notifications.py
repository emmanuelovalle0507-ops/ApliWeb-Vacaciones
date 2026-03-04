from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas.auth import UserSummary
from app.schemas.notification import MarkAllReadOut, NotificationCountOut, NotificationList, NotificationOut
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _to_out(n) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        type=n.type.value,
        title=n.title,
        body=n.body,
        entity_type=n.entity_type,
        entity_id=n.entity_id,
        is_read=n.is_read,
        email_status=n.email_status.value,
        created_at=n.created_at,
    )


@router.get("/me", response_model=NotificationList)
def list_my_notifications(
    limit: int = 50,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> NotificationList:
    service = NotificationService(db)
    items = service.list_for_user(current_user.id, limit=limit, unread_only=unread_only)
    unread = service.count_unread(current_user.id)
    return NotificationList(items=[_to_out(n) for n in items], unread_count=unread)


@router.get("/me/count", response_model=NotificationCountOut)
def count_unread(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> NotificationCountOut:
    service = NotificationService(db)
    return NotificationCountOut(unread_count=service.count_unread(current_user.id))


@router.patch("/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
):
    service = NotificationService(db)
    ok = service.mark_read(notification_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada.")
    db.commit()
    return {"ok": True}


@router.post("/me/read-all", response_model=MarkAllReadOut)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> MarkAllReadOut:
    service = NotificationService(db)
    count = service.mark_all_read(current_user.id)
    db.commit()
    return MarkAllReadOut(marked_count=count)
