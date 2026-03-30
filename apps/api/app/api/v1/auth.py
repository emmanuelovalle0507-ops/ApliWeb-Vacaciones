from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.vacation_request import VacationRequestStatus
from app.repositories.audit_repo import AuditRepository
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserSummary
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpdateRequest(BaseModel):
    phone: str | None = None
    emergency_contact: str | None = None


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    service = AuthService(UserRepository(db), TeamRepository(db))
    audit = AuditRepository(db)
    try:
        result = service.login(payload.email, payload.password)
        audit.log(
            actor_user_id=result.user.id,
            action="LOGIN_SUCCESS",
            entity_type="user",
            entity_id=result.user.id,
            metadata={"email": payload.email, "role": result.user.role},
        )
        db.commit()
        return result
    except ValueError as exc:
        audit.log(
            actor_user_id=None,
            action="LOGIN_FAILED",
            entity_type="user",
            entity_id="unknown",
            metadata={"email": payload.email, "reason": str(exc)},
        )
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/me", response_model=UserSummary)
def me(current_user: UserSummary = Depends(get_current_user)) -> UserSummary:
    return current_user


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    service = AuthService(UserRepository(db))
    audit = AuditRepository(db)
    try:
        service.change_password(current_user.id, payload.current_password, payload.new_password)
        audit.log(
            actor_user_id=current_user.id,
            action="PASSWORD_CHANGED",
            entity_type="user",
            entity_id=current_user.id,
        )
        db.commit()
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"message": "Contraseña actualizada correctamente."}


@router.get("/me/profile")
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    """Get full profile info including phone and emergency contact."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return {
        "phone": user.phone,
        "emergency_contact": user.emergency_contact,
    }


@router.patch("/me/profile")
def update_my_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    """Update own profile fields (phone, emergency_contact)."""
    user_repo = UserRepository(db)
    user = user_repo.get_by_id(current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    if payload.emergency_contact is not None:
        user.emergency_contact = payload.emergency_contact.strip() or None

    db.commit()
    db.refresh(user)
    return {
        "phone": user.phone,
        "emergency_contact": user.emergency_contact,
        "message": "Perfil actualizado correctamente.",
    }


@router.get("/me/team-info")
def get_my_team_info(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> dict:
    """Get team members, manager info, and who is currently on vacation."""
    user_repo = UserRepository(db)
    request_repo = VacationRequestRepository(db)

    user = user_repo.get_by_id(current_user.id)
    if not user or not user.team_id:
        return {"manager": None, "team_members": [], "on_vacation_now": []}

    team_id = str(user.team_id)
    today = date.today()

    # Manager info
    manager_info = None
    if user.manager_id:
        mgr = user_repo.get_by_id(str(user.manager_id))
        if mgr:
            manager_info = {
                "id": str(mgr.id),
                "full_name": mgr.full_name,
                "email": mgr.email,
                "position": mgr.position,
                "role": mgr.role.value,
            }

    # Team members (excluding self)
    all_members = user_repo.list_all(team_id=team_id)
    members = []
    for m in all_members:
        if str(m.id) == str(current_user.id):
            continue
        members.append({
            "id": str(m.id),
            "full_name": m.full_name,
            "email": m.email,
            "position": m.position,
            "role": m.role.value,
        })

    # Who is on vacation right now
    approved = request_repo.list_team_approved_in_range(team_id, today, today)
    on_vacation = []
    for r in approved:
        if r.start_date <= today <= r.end_date:
            emp = user_repo.get_by_id(str(r.employee_id))
            on_vacation.append({
                "id": str(r.employee_id),
                "full_name": emp.full_name if emp else "Desconocido",
                "start_date": r.start_date.strftime("%Y-%m-%d"),
                "end_date": r.end_date.strftime("%Y-%m-%d"),
            })

    # Upcoming vacations (next 30 days)
    from datetime import timedelta
    future = today + timedelta(days=30)
    upcoming_reqs = request_repo.list_team_approved_in_range(team_id, today, future)
    upcoming = []
    seen_ids: set[str] = set()
    for r in upcoming_reqs:
        if r.start_date > today and str(r.employee_id) not in seen_ids:
            emp = user_repo.get_by_id(str(r.employee_id))
            upcoming.append({
                "id": str(r.employee_id),
                "full_name": emp.full_name if emp else "Desconocido",
                "start_date": r.start_date.strftime("%Y-%m-%d"),
                "end_date": r.end_date.strftime("%Y-%m-%d"),
            })
            seen_ids.add(str(r.employee_id))

    return {
        "manager": manager_info,
        "team_members": members,
        "on_vacation_now": on_vacation,
        "upcoming_vacations": upcoming,
    }
