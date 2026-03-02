from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.repositories.user_repo import UserRepository
from app.schemas.admin import UserListOut, UserOut
from app.schemas.auth import UserSummary
from app.schemas.vacation_request import (
    VacationApprovalResponse,
    VacationRequestDecision,
    VacationRequestList,
    VacationRequestOut,
)
from app.mappers.vacation_request_mapper import vacation_request_to_out as _to_out, vacation_request_to_out_enriched as _to_out_enriched
from app.services.vacation_request_service import PolicyValidationError, VacationRequestService

router = APIRouter(prefix="/manager", tags=["manager"])


@router.get("/vacation-requests/pending", response_model=VacationRequestList)
def list_pending(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> VacationRequestList:
    service = VacationRequestService(db)
    items = service.list_pending_for_manager(current_user.id)
    return VacationRequestList(items=[_to_out_enriched(item, db) for item in items])


@router.post("/vacation-requests/{request_id}/approve", response_model=VacationApprovalResponse)
def approve_request(
    request_id: str,
    payload: VacationRequestDecision,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> VacationApprovalResponse:
    service = VacationRequestService(db)
    try:
        request, balance = service.approve(request_id, current_user.id, payload.decision_comment)
    except PolicyValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return VacationApprovalResponse(
        request=_to_out_enriched(request, db),
        balance={
            "user_id": str(balance.user_id),
            "available_days": float(balance.available_days),
            "used_days": float(balance.used_days),
        },
    )


@router.post("/vacation-requests/{request_id}/reject", response_model=VacationRequestOut)
def reject_request(
    request_id: str,
    payload: VacationRequestDecision,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> VacationRequestOut:
    service = VacationRequestService(db)
    try:
        request = service.reject(request_id, current_user.id, payload.decision_comment)
    except PolicyValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return _to_out_enriched(request, db)


@router.get("/team/members", response_model=UserListOut)
def list_team_members(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> UserListOut:
    repo = UserRepository(db)
    members = repo.list_by_manager_id(current_user.id)
    return UserListOut(
        items=[
            UserOut(
                id=str(u.id),
                email=u.email,
                full_name=u.full_name,
                role=u.role.value,
                team_id=str(u.team_id) if u.team_id else None,
                manager_id=str(u.manager_id) if u.manager_id else None,
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in members
        ]
    )
