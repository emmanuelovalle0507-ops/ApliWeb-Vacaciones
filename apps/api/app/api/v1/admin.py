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
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.services.email_service import send_welcome_email
from app.schemas.admin import (
    AdminUserCreateIn,
    BalanceListOut,
    BalanceWithUserOut,
    PaginatedBalanceListOut,
    PaginatedUserListOut,
    TeamListOut,
    TeamOut,
    UserCreateIn,
    UserListOut,
    UserOut,
    UserUpdateIn,
)
from app.schemas.auth import UserSummary
from app.schemas.pagination import PaginationMeta, PaginationParams
from app.schemas.vacation_balance import BalanceAdjustmentIn, VacationBalanceOut
from app.mappers.vacation_request_mapper import vacation_request_to_out as _req_to_out, vacation_request_to_out_enriched as _req_to_out_enriched
from app.schemas.vacation_request import PaginatedVacationRequestList, VacationRequestList, VacationRequestOut
from app.services.vacation_request_service import VacationRequestService

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Users ────────────────────────────────────────────────────────────
@router.get("/users", response_model=PaginatedUserListOut)
def list_users(
    role: str | None = Query(None),
    team_id: str | None = Query(None),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
    pagination: PaginationParams = Depends(),
) -> PaginatedUserListOut:
    repo = UserRepository(db)
    team_repo = TeamRepository(db)
    users, total = repo.list_all_paginated(
        role=role, team_id=team_id, search=search,
        offset=pagination.offset, limit=pagination.limit,
    )
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
        mgr_ids = repo.get_manager_ids(str(u.id))
        items.append(
            UserOut(
                id=str(u.id),
                email=u.email,
                full_name=u.full_name,
                role=u.role.value,
                team_id=str(u.team_id) if u.team_id else None,
                team_name=t_name,
                manager_id=str(u.manager_id) if u.manager_id else None,
                manager_ids=mgr_ids,
                is_active=u.is_active,
                hire_date=u.hire_date,
                position=u.position,
                created_at=u.created_at,
            )
        )
    return PaginatedUserListOut(
        items=items,
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


def _user_to_out(u: User, repo: UserRepository, team_repo: TeamRepository) -> UserOut:
    t_name = None
    if u.team_id:
        t = team_repo.get_by_id(str(u.team_id))
        t_name = t.name if t else None
    return UserOut(
        id=str(u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role.value,
        team_id=str(u.team_id) if u.team_id else None,
        team_name=t_name,
        manager_id=str(u.manager_id) if u.manager_id else None,
        manager_ids=repo.get_manager_ids(str(u.id)),
        is_active=u.is_active,
        hire_date=u.hire_date,
        position=u.position,
        created_at=u.created_at,
    )


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminUserCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> UserOut:
    # HR can only create EMPLOYEE or MANAGER
    if current_user.role == "HR" and payload.role not in ("EMPLOYEE", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RH solo puede crear usuarios con rol EMPLOYEE o MANAGER.",
        )

    repo = UserRepository(db)
    team_repo = TeamRepository(db)

    if repo.get_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un usuario con el email {payload.email}.",
        )

    if payload.team_id:
        if not team_repo.get_by_id(payload.team_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipo no encontrado.")

    for mid in payload.manager_ids:
        mgr = repo.get_by_id(mid)
        if not mgr:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Manager {mid} no encontrado.")

    user = User(
        email=payload.email,
        full_name=payload.full_name,
        role=UserRole(payload.role),
        password_hash=hash_password(payload.password),
        team_id=payload.team_id,
        manager_id=payload.manager_ids[0] if payload.manager_ids else None,
        is_active=True,
        must_change_password=True,
        hire_date=payload.hire_date,
        position=payload.position,
    )
    user = repo.add(user)

    if payload.manager_ids:
        repo.set_managers(str(user.id), payload.manager_ids)

    db.commit()

    # Send welcome email (demo mode logs to console if SMTP not configured)
    email_sent = send_welcome_email(
        to_email=payload.email,
        full_name=payload.full_name,
        temp_password=payload.password,
    )

    out = _user_to_out(user, repo, team_repo)
    # Attach email_sent flag to response for frontend feedback
    return {**out.model_dump(), "email_sent": email_sent}


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> UserOut:
    repo = UserRepository(db)
    team_repo = TeamRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # HR cannot modify ADMIN users at all
    if current_user.role == "HR" and user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RH no puede modificar usuarios con rol Administrador.",
        )

    # HR cannot change role to ADMIN or HR
    if current_user.role == "HR" and payload.role and payload.role not in ("EMPLOYEE", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RH solo puede asignar roles EMPLOYEE o MANAGER.",
        )

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = UserRole(payload.role)
    if payload.team_id is not None:
        if payload.team_id and not team_repo.get_by_id(payload.team_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Equipo no encontrado.")
        user.team_id = payload.team_id or None
    if payload.hire_date is not None:
        user.hire_date = payload.hire_date
    if payload.position is not None:
        user.position = payload.position
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.manager_ids is not None:
        for mid in payload.manager_ids:
            if not repo.get_by_id(mid):
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Manager {mid} no encontrado.")
        repo.set_managers(user_id, payload.manager_ids)
        user.manager_id = payload.manager_ids[0] if payload.manager_ids else None

    db.commit()
    db.refresh(user)
    return _user_to_out(user, repo, team_repo)


@router.patch("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> UserOut:
    repo = UserRepository(db)
    team_repo = TeamRepository(db)
    user = repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    if str(user.id) == current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No puedes desactivarte a ti mismo.")
    # HR cannot deactivate ADMIN users
    if current_user.role == "HR" and user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="RH no puede desactivar usuarios con rol Administrador.",
        )
    user.is_active = False
    db.commit()
    db.refresh(user)
    return _user_to_out(user, repo, team_repo)


# ── Requests ─────────────────────────────────────────────────────────
@router.get("/vacation-requests", response_model=PaginatedVacationRequestList)
def list_all_requests(
    request_status: str | None = Query(None, alias="status"),
    team_id: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
    pagination: PaginationParams = Depends(),
) -> PaginatedVacationRequestList:
    repo = VacationRequestRepository(db)
    items, total = repo.list_all_paginated(
        status=request_status, team_id=team_id, start_date=start_date, end_date=end_date,
        offset=pagination.offset, limit=pagination.limit,
    )
    return PaginatedVacationRequestList(
        items=[_req_to_out_enriched(r, db) for r in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


# ── Balances ─────────────────────────────────────────────────────────
@router.get("/vacation-balances", response_model=PaginatedBalanceListOut)
def list_all_balances(
    year: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
    pagination: PaginationParams = Depends(),
) -> PaginatedBalanceListOut:
    selected_year = year or datetime.now(timezone.utc).year
    repo = VacationBalanceRepository(db)
    user_repo = UserRepository(db)
    team_repo = TeamRepository(db)
    balances, total = repo.list_by_year_paginated(
        selected_year, offset=pagination.offset, limit=pagination.limit
    )
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
    return PaginatedBalanceListOut(
        items=items,
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


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
