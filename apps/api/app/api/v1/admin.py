from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_balance_repo import VacationBalanceRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.schemas.admin import (
    BalanceListOut,
    BalanceWithUserOut,
    TeamListOut,
    TeamOut,
    UserListOut,
    UserOut,
)
from app.schemas.auth import UserSummary
from app.schemas.vacation_balance import BalanceAdjustmentIn, VacationBalanceOut
from app.mappers.vacation_request_mapper import vacation_request_to_out as _req_to_out, vacation_request_to_out_enriched as _req_to_out_enriched
from app.schemas.vacation_request import VacationRequestList, VacationRequestOut
from app.services.vacation_request_service import VacationRequestService

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Users ────────────────────────────────────────────────────────────
@router.get("/users", response_model=UserListOut)
def list_users(
    role: str | None = Query(None),
    team_id: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> UserListOut:
    repo = UserRepository(db)
    team_repo = TeamRepository(db)
    users = repo.list_all(role=role, team_id=team_id, search=search)
    teams_cache: dict[str, str] = {}
    items = []
    for u in users:
        t_name = None
        if u.team_id:
            tid = str(u.team_id)
            if tid not in teams_cache:
                t = team_repo.get_by_id(tid)
                teams_cache[tid] = t.name if t else "—"
            t_name = teams_cache[tid]
        items.append(
            UserOut(
                id=str(u.id),
                email=u.email,
                full_name=u.full_name,
                role=u.role.value,
                team_id=str(u.team_id) if u.team_id else None,
                team_name=t_name,
                manager_id=str(u.manager_id) if u.manager_id else None,
                is_active=u.is_active,
                created_at=u.created_at,
            )
        )
    return UserListOut(items=items)


# ── Requests ─────────────────────────────────────────────────────────
@router.get("/vacation-requests", response_model=VacationRequestList)
def list_all_requests(
    request_status: str | None = Query(None, alias="status"),
    team_id: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> VacationRequestList:
    repo = VacationRequestRepository(db)
    items = repo.list_all(
        status=request_status, team_id=team_id, start_date=start_date, end_date=end_date
    )
    return VacationRequestList(items=[_req_to_out_enriched(r, db) for r in items])


# ── Balances ─────────────────────────────────────────────────────────
@router.get("/vacation-balances", response_model=BalanceListOut)
def list_all_balances(
    year: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> BalanceListOut:
    selected_year = year or datetime.now(timezone.utc).year
    repo = VacationBalanceRepository(db)
    user_repo = UserRepository(db)
    team_repo = TeamRepository(db)
    balances = repo.list_by_year(selected_year)
    teams_cache: dict[str, str] = {}
    items = []
    for b in balances:
        u = user_repo.get_by_id(str(b.user_id))
        u_name = u.full_name if u else "—"
        u_area = "—"
        if u and u.team_id:
            tid = str(u.team_id)
            if tid not in teams_cache:
                t = team_repo.get_by_id(tid)
                teams_cache[tid] = t.name if t else "—"
            u_area = teams_cache[tid]
        items.append(
            BalanceWithUserOut(
                user_id=str(b.user_id),
                user_name=u_name,
                user_area=u_area,
                year=b.year,
                available_days=float(b.available_days),
                used_days=float(b.used_days),
            )
        )
    return BalanceListOut(items=items)


# ── Teams ────────────────────────────────────────────────────────────
@router.get("/teams", response_model=TeamListOut)
def list_teams(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "MANAGER", "HR")),
) -> TeamListOut:
    repo = TeamRepository(db)
    teams = repo.list_all()
    return TeamListOut(
        items=[
            TeamOut(id=str(t.id), name=t.name, is_active=t.is_active)
            for t in teams
        ]
    )


# ── Balance Adjustment ───────────────────────────────────────────────
@router.post("/vacation-balances/{user_id}/adjust", response_model=VacationBalanceOut)
def adjust_balance(
    user_id: str,
    payload: BalanceAdjustmentIn,
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN")),
) -> VacationBalanceOut:
    selected_year = year or datetime.now(timezone.utc).year
    service = VacationRequestService(db)
    try:
        balance = service.admin_adjust_balance(
            admin_id=current_user.id,
            user_id=user_id,
            year=selected_year,
            days_delta=Decimal(str(payload.days_delta)),
            reason=payload.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return VacationBalanceOut(
        user_id=str(balance.user_id),
        year=balance.year,
        available_days=float(balance.available_days),
        used_days=float(balance.used_days),
    )
