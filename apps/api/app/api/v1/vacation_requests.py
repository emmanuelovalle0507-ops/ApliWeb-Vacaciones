from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.schemas.auth import UserSummary
from app.schemas.pagination import PaginationMeta, PaginationParams
from app.schemas.vacation_balance import VacationBalanceOut
from app.mappers.vacation_request_mapper import vacation_request_to_out as _to_out, vacation_request_to_out_enriched as _to_out_enriched
from app.schemas.vacation_request import PaginatedVacationRequestList, PreValidateRequest, PreValidateResponse, VacationRequestCreate, VacationRequestList, VacationRequestOut
from app.services.vacation_request_service import PolicyValidationError, VacationRequestService

router = APIRouter(prefix="/vacation-requests", tags=["vacation-requests"])


@router.post("/validate", response_model=PreValidateResponse)
def pre_validate_request(
    payload: PreValidateRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
) -> PreValidateResponse:
    service = VacationRequestService(db)
    result = service.pre_validate(current_user.id, payload.start_date, payload.end_date)
    return PreValidateResponse(**result)


@router.post("", response_model=VacationRequestOut)
def create_request(
    payload: VacationRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
) -> VacationRequestOut:
    service = VacationRequestService(db)
    try:
        request = service.create_request(current_user.id, payload.start_date, payload.end_date, payload.reason)
        return _to_out_enriched(request, db)
    except PolicyValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/me", response_model=PaginatedVacationRequestList)
def list_my_requests(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
    pagination: PaginationParams = Depends(),
) -> PaginatedVacationRequestList:
    repo = VacationRequestRepository(db)
    items, total = repo.list_by_employee_paginated(
        str(current_user.id), offset=pagination.offset, limit=pagination.limit
    )
    return PaginatedVacationRequestList(
        items=[_to_out_enriched(item, db) for item in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


@router.post("/{request_id}/cancel", response_model=VacationRequestOut)
def cancel_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
) -> VacationRequestOut:
    service = VacationRequestService(db)
    try:
        item = service.cancel(request_id, current_user.id)
        return _to_out_enriched(item, db)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/me/balance", response_model=VacationBalanceOut)
def my_balance(
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
) -> VacationBalanceOut:
    selected_year = year or datetime.now(timezone.utc).year
    service = VacationRequestService(db)
    try:
        balance = service.get_my_balance(current_user.id, selected_year)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return VacationBalanceOut(
        user_id=str(balance.user_id),
        year=balance.year,
        available_days=float(balance.available_days),
        used_days=float(balance.used_days),
    )
