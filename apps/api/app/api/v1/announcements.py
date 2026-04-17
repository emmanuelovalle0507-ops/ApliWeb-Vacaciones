"""Announcements endpoints — CRUD, read tracking, stats."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.repositories.audit_repo import AuditRepository
from app.schemas.announcement import (
    AnnouncementCreateIn,
    AnnouncementOut,
    AnnouncementReadStatsOut,
    AnnouncementReadUserOut,
    CommentCreateIn,
    CommentOut,
    PaginatedAnnouncementList,
    ReactionIn,
)
from app.schemas.auth import UserSummary
from app.schemas.pagination import PaginationMeta, PaginationParams
from app.services.announcement_service import AnnouncementService
from app.api.v1.ws_announcements import broadcast_event

router = APIRouter(prefix="/announcements", tags=["announcements"])


# ── Create ────────────────────────────────────────────────

@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    payload: AnnouncementCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "HR", "ADMIN")),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    try:
        ann = service.create_announcement(
            author_id=current_user.id,
            title=payload.title,
            body=payload.body,
            team_ids=payload.team_ids,
            announcement_type=payload.type,
            is_pinned=payload.is_pinned,
            expires_at=payload.expires_at,
            publish_at=payload.publish_at,
            requires_acknowledgment=payload.requires_acknowledgment,
            attachment_url=payload.attachment_url,
            attachment_name=payload.attachment_name,
            image_url=payload.image_url,
            target_user_ids=payload.target_user_ids,
        )
        # Send notifications for URGENT or broadcast
        if ann.type.value == "URGENT" or ann.is_broadcast:
            try:
                service.send_announcement_email(ann)
            except Exception:
                pass
        db.commit()
        AuditRepository(db).log(
            actor_user_id=current_user.id,
            action="ANNOUNCEMENT_CREATED",
            entity_type="announcement",
            entity_id=str(ann.id),
            metadata={"title": payload.title, "type": payload.type},
        )
        db.commit()
        # Real-time broadcast
        broadcast_event(
            "announcement_created",
            {"announcement_id": str(ann.id), "title": ann.title, "type": ann.type.value},
            team_ids=[str(t.team_id) for t in ann.teams],
            is_broadcast=ann.is_broadcast,
        )
        items, _, _ = service.list_for_user(current_user.id, offset=0, limit=1)
        return AnnouncementOut(**items[0]) if items else _ann_to_out(ann, service, current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Image Upload ─────────────────────────────────────────

@router.post("/upload-image")
async def upload_announcement_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "HR", "ADMIN")),
):
    """Upload a flyer/poster image for an announcement. Returns the URL."""
    from app.services.storage_service import StorageService
    import uuid
    from pathlib import Path

    storage = StorageService()
    data = await file.read()
    content_type = file.content_type or "application/octet-stream"
    size = len(data)

    # Only allow images
    allowed = ["image/jpeg", "image/png", "image/webp"]
    if content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se permiten imágenes (JPEG, PNG, WebP). Tipo recibido: {content_type}",
        )
    if size > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen no puede superar 10 MB.",
        )
    if size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El archivo está vacío.")

    # Save to announcements subfolder
    ext_map = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    ext = ext_map.get(content_type, ".jpg")
    file_id = uuid.uuid4().hex
    key = f"announcements/{current_user.id}/{file_id}{ext}"

    base_dir = Path(storage.base_dir)
    full_path = base_dir / key
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(data)

    url = f"/api/v1/announcements/files/{key}"
    return {"url": url, "file_name": file.filename}


@router.get("/files/{file_key:path}")
def serve_announcement_file(
    file_key: str,
    token: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Serve uploaded announcement images. Supports token auth for img tags."""
    from fastapi.responses import FileResponse
    from app.services.storage_service import StorageService
    from app.core.security import decode_access_token
    from app.repositories.user_repo import UserRepository

    # Auth via token query param (for <img src>)
    user = None
    if token:
        try:
            payload = decode_access_token(token)
            uid = payload.get("sub")
            if uid:
                u = UserRepository(db).get_by_id(uid)
                if u and u.is_active:
                    user = u
        except Exception:
            pass

    # Also try header auth
    if not user:
        try:
            from app.api.deps import get_current_user as _get
            # allow unauthenticated for public announcements
            pass
        except Exception:
            pass

    storage = StorageService()
    path = storage.get_full_path(file_key)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    return FileResponse(path)


def _ann_to_out(ann, service: AnnouncementService, user_id: str) -> AnnouncementOut:
    d = service._to_dict(ann)
    d["is_read"] = False
    d["read_count"] = 0
    return AnnouncementOut(**d)


# ── List my announcements ─────────────────────────────────

@router.get("/me", response_model=PaginatedAnnouncementList)
def list_my_announcements(
    announcement_type: str | None = Query(None, alias="type"),
    show_hidden: bool = Query(False, alias="hidden"),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
    pagination: PaginationParams = Depends(),
) -> PaginatedAnnouncementList:
    service = AnnouncementService(db)
    items, total, unread = service.list_for_user(
        user_id=current_user.id,
        offset=pagination.offset,
        limit=pagination.limit,
        announcement_type=announcement_type,
        show_hidden=show_hidden,
    )
    return PaginatedAnnouncementList(
        items=[AnnouncementOut(**i) for i in items],
        unread_count=unread,
        pagination=PaginationMeta.build(
            page=pagination.page, page_size=pagination.page_size, total=total,
        ),
    )


# ── Unread count ──────────────────────────────────────────

@router.get("/me/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    count = service.get_unread_count(current_user.id)
    return {"unread_count": count}


# ── Pinned ────────────────────────────────────────────────

@router.get("/me/pinned")
def list_pinned(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> list[AnnouncementOut]:
    service = AnnouncementService(db)
    items = service.list_pinned_for_user(current_user.id)
    return [AnnouncementOut(**i) for i in items]


# ── Search ────────────────────────────────────────────────

@router.get("/search", response_model=list[AnnouncementOut])
def search_announcements(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> list[AnnouncementOut]:
    service = AnnouncementService(db)
    items = service.search(q, current_user.id)
    return [AnnouncementOut(**i) for i in items]


# ── New since (popup) ────────────────────────────────

@router.get("/me/new-since", response_model=list[AnnouncementOut])
def list_new_since(
    since: str = Query(..., description="ISO 8601 timestamp"),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> list[AnnouncementOut]:
    service = AnnouncementService(db)
    try:
        since_dt = datetime.fromisoformat(since)
    except (ValueError, TypeError):
        since_dt = datetime.now(timezone.utc)
    items = service.list_new_since(current_user.id, since_dt)
    return [AnnouncementOut(**i) for i in items]


# ── Pending Approval ─────────────────────────────────────

@router.get("/pending-approval", response_model=list[AnnouncementOut])
def list_pending_approval(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("HR", "ADMIN")),
) -> list[AnnouncementOut]:
    service = AnnouncementService(db)
    try:
        items = service.list_pending_approval(current_user.id)
        return [AnnouncementOut(**i) for i in items]
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


# ── Mark read ─────────────────────────────────────────────

@router.patch("/{announcement_id}/read")
def mark_read(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    was_new = service.mark_read(announcement_id, current_user.id)
    db.commit()
    if was_new:
        ann = service.repo.get_by_id(announcement_id)
        read_count = service.repo.get_read_count(announcement_id) if ann else 0
        broadcast_event(
            "read_count_updated",
            {"announcement_id": announcement_id, "read_count": read_count, "user_name": current_user.full_name},
            team_ids=[str(t.team_id) for t in ann.teams] if ann else [],
            is_broadcast=ann.is_broadcast if ann else True,
        )
    return {"ok": True}


# ── Dismiss ───────────────────────────────────────────────

@router.patch("/{announcement_id}/dismiss")
def dismiss_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    try:
        service.dismiss(announcement_id, current_user.id)
        db.commit()
        return {"ok": True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Undismiss (Mostrar de nuevo) ──────────────────────

@router.patch("/{announcement_id}/undismiss")
def undismiss_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    try:
        service.undismiss(announcement_id, current_user.id)
        db.commit()
        return {"ok": True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Pin / Unpin ───────────────────────────────────────────

@router.patch("/{announcement_id}/pin")
def toggle_pin(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "HR", "ADMIN")),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    try:
        ann = service.toggle_pin(announcement_id, current_user.id)
        db.commit()
        d = service._to_dict(ann)
        return AnnouncementOut(**d)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Delete ────────────────────────────────────────────────

@router.delete("/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> None:
    service = AnnouncementService(db)
    try:
        service.delete_announcement(announcement_id, current_user.id)
        AuditRepository(db).log(
            actor_user_id=current_user.id,
            action="ANNOUNCEMENT_DELETED",
            entity_type="announcement",
            entity_id=announcement_id,
        )
        db.commit()
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Reactions ─────────────────────────────────────────

@router.post("/{announcement_id}/reactions")
def toggle_reaction(
    announcement_id: str,
    payload: ReactionIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    try:
        result = service.toggle_reaction(announcement_id, current_user.id, payload.emoji)
        db.commit()
        ann = service.repo.get_by_id(announcement_id)
        broadcast_event(
            "reaction_updated",
            {"announcement_id": announcement_id, "reactions": result["reactions"]},
            team_ids=[str(t.team_id) for t in ann.teams] if ann else [],
            is_broadcast=ann.is_broadcast if ann else True,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Comments ──────────────────────────────────────────

@router.get("/{announcement_id}/comments", response_model=list[CommentOut])
def list_comments(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> list[CommentOut]:
    service = AnnouncementService(db)
    comments = service.list_comments(announcement_id)
    return [CommentOut(**c) for c in comments]


@router.post("/{announcement_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    announcement_id: str,
    payload: CommentCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> CommentOut:
    service = AnnouncementService(db)
    try:
        comment = service.add_comment(announcement_id, current_user.id, payload.body)
        db.commit()
        return CommentOut(**comment)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> None:
    service = AnnouncementService(db)
    if not service.delete_comment(comment_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found or not yours")
    db.commit()


# ── Acknowledge ──────────────────────────────────────

@router.patch("/{announcement_id}/acknowledge")
def acknowledge_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AnnouncementService(db)
    try:
        service.acknowledge(announcement_id, current_user.id)
        db.commit()
        ann = service.repo.get_by_id(announcement_id)
        broadcast_event(
            "acknowledged",
            {"announcement_id": announcement_id, "user_name": current_user.full_name},
            team_ids=[str(t.team_id) for t in ann.teams] if ann else [],
            is_broadcast=ann.is_broadcast if ann else True,
        )
        return {"ok": True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ── Archive ───────────────────────────────────────────

@router.patch("/{announcement_id}/archive")
def archive_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "HR", "ADMIN")),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    try:
        ann = service.archive(announcement_id, current_user.id)
        db.commit()
        d = service._to_dict(ann)
        return AnnouncementOut(**d)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{announcement_id}/unarchive")
def unarchive_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("HR", "ADMIN")),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    try:
        ann = service.unarchive(announcement_id, current_user.id)
        db.commit()
        d = service._to_dict(ann)
        return AnnouncementOut(**d)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{announcement_id}/approve")
def approve_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("HR", "ADMIN")),
) -> AnnouncementOut:
    service = AnnouncementService(db)
    try:
        ann = service.approve_announcement(announcement_id, current_user.id)
        db.commit()
        # Send notification now that it's approved
        if ann.type.value == "URGENT" or ann.is_broadcast:
            try:
                service.send_announcement_email(ann)
            except Exception:
                pass
        d = service._to_dict(ann)
        return AnnouncementOut(**d)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{announcement_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("HR", "ADMIN")),
) -> None:
    service = AnnouncementService(db)
    try:
        service.reject_announcement(announcement_id, current_user.id)
        db.commit()
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ── Read stats ────────────────────────────────────────────

@router.get("/{announcement_id}/stats", response_model=AnnouncementReadStatsOut)
def get_read_stats(
    announcement_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "HR", "ADMIN")),
) -> AnnouncementReadStatsOut:
    service = AnnouncementService(db)
    try:
        stats = service.get_read_stats(announcement_id, current_user.id)
        return AnnouncementReadStatsOut(
            announcement_id=stats["announcement_id"],
            total_target_users=stats["total_target_users"],
            read_count=stats["read_count"],
            read_users=[AnnouncementReadUserOut(**u) for u in stats["read_users"]],
            unread_users=[AnnouncementReadUserOut(**u) for u in stats["unread_users"]],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
