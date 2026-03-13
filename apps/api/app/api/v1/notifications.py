from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.repositories.notification_repo import NotificationRepository
from app.schemas.auth import UserSummary
from app.schemas.notification import MarkAllReadOut, NotificationCountOut, NotificationList, NotificationOut, PaginatedNotificationList
from app.schemas.pagination import PaginationMeta, PaginationParams
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


@router.get("/me", response_model=PaginatedNotificationList)
def list_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
) -> PaginatedNotificationList:
    repo = NotificationRepository(db)
    items, total = repo.list_by_user_paginated(
        str(current_user.id), offset=pagination.offset, limit=pagination.limit, unread_only=unread_only
    )
    unread = repo.count_unread(str(current_user.id))
    return PaginatedNotificationList(
        items=[_to_out(n) for n in items],
        unread_count=unread,
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


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
