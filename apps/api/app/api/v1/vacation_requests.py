from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.schemas.auth import UserSummary
from app.schemas.pagination import PaginationMeta, PaginationParams
from app.schemas.vacation_balance import VacationBalanceOut
from app.mappers.vacation_request_mapper import vacation_request_to_out as _to_out, vacation_request_to_out_enriched as _to_out_enriched
from app.schemas.vacation_request import PaginatedVacationRequestList, PreValidateRequest, PreValidateResponse, VacationRequestCreate, VacationRequestList, VacationRequestOut, VacationRequestUpdate
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
    filter_status: str | None = Query(None, alias="status"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
    pagination: PaginationParams = Depends(),
) -> PaginatedVacationRequestList:
    repo = VacationRequestRepository(db)
    items, total = repo.list_by_employee_paginated(
        str(current_user.id),
        status=filter_status,
        start_date=start_date,
        end_date=end_date,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return PaginatedVacationRequestList(
        items=[_to_out_enriched(item, db) for item in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


@router.get("/{request_id}", response_model=VacationRequestOut)
def get_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> VacationRequestOut:
    repo = VacationRequestRepository(db)
    item = repo.get_by_id(request_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    # Employees can only see their own requests; managers can see their team's
    if current_user.role == "EMPLOYEE" and str(item.employee_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver esta solicitud.")
    return _to_out_enriched(item, db)


@router.put("/{request_id}", response_model=VacationRequestOut)
def edit_request(
    request_id: str,
    payload: VacationRequestUpdate,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
) -> VacationRequestOut:
    service = VacationRequestService(db)
    try:
        item = service.edit_request(request_id, current_user.id, payload.start_date, payload.end_date, payload.reason)
        return _to_out_enriched(item, db)
    except PolicyValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


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


@router.get("/{request_id}/export-ics")
def export_ics(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
):
    """Export an approved vacation request as an .ics calendar file."""
    repo = VacationRequestRepository(db)
    user_repo = UserRepository(db)
    item = repo.get_by_id(request_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")
    if item.status.value != "APPROVED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden exportar solicitudes aprobadas.")
    # Access check
    if current_user.role == "EMPLOYEE" and str(item.employee_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso.")

    employee = user_repo.get_by_id(str(item.employee_id))
    emp_name = employee.full_name if employee else "Empleado"
    emp_email = employee.email if employee else ""

    # Build ICS — end_date in ICS DTEND;VALUE=DATE is exclusive, so +1 day
    end_exclusive = item.end_date + timedelta(days=1)
    uid = f"{item.id}@vacaciones.seekop.com"

    now_utc = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dtstart = item.start_date.strftime("%Y%m%d")
    dtend = end_exclusive.strftime("%Y%m%d")

    ics = (
        "BEGIN:VCALENDAR\r\n"
        "VERSION:2.0\r\n"
        "PRODID:-//SEEKOP//Vacaciones//ES\r\n"
        "CALSCALE:GREGORIAN\r\n"
        "METHOD:PUBLISH\r\n"
        "BEGIN:VEVENT\r\n"
        f"UID:{uid}\r\n"
        f"DTSTAMP:{now_utc}\r\n"
        f"DTSTART;VALUE=DATE:{dtstart}\r\n"
        f"DTEND;VALUE=DATE:{dtend}\r\n"
        f"SUMMARY:Vacaciones - {emp_name}\r\n"
        f"DESCRIPTION:Solicitud de vacaciones aprobada ({item.requested_business_days} dias habiles)\r\n"
        "STATUS:CONFIRMED\r\n"
        "TRANSP:OPAQUE\r\n"
        "BEGIN:VALARM\r\n"
        "TRIGGER:-P1D\r\n"
        "ACTION:DISPLAY\r\n"
        f"DESCRIPTION:Vacaciones de {emp_name} comienzan manana\r\n"
        "END:VALARM\r\n"
        "END:VEVENT\r\n"
        "END:VCALENDAR\r\n"
    )

    filename = f"vacaciones_{emp_name.replace(' ', '_')}_{dtstart}.ics"
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
