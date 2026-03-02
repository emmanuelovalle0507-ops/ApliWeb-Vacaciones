"""Seed inicial del MVP.

Este script crea datos base para probar el sistema localmente:
- 1 ADMIN
- 1 MANAGER
- 1 EMPLOYEE (asignado al manager)
- Balance anual inicial para el employee

Diseño del script:
1) Es idempotente: si el usuario ya existe por email, no lo duplica.
2) Usa transacción para garantizar consistencia.
3) Explica cada paso por consola para facilitar onboarding.

Uso:
    python -m scripts.seed_mvp

Desde:
    apps/api
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.team import Team
from app.models.team_policy import TeamPolicy
from app.models.user import User, UserRole
from app.models.vacation_balance import VacationBalance


SEED_YEAR = datetime.now(timezone.utc).year


def _get_user_by_email(db, email: str) -> User | None:
    return db.execute(select(User).where(User.email == email)).scalar_one_or_none()


def _ensure_user(
    db,
    *,
    email: str,
    full_name: str,
    role: UserRole,
    password_plain: str,
    team_id=None,
    manager_id=None,
) -> User:
    existing = _get_user_by_email(db, email)
    if existing:
        print(f"[seed] Usuario existente: {email} ({existing.role.value})")
        if manager_id and existing.manager_id != manager_id:
            existing.manager_id = manager_id
            print(f"[seed] Manager actualizado para {email}")
        if team_id and existing.team_id != team_id:
            existing.team_id = team_id
            print(f"[seed] Team actualizado para {email}")
        return existing

    user = User(
        email=email,
        full_name=full_name,
        role=role,
        password_hash=hash_password(password_plain),
        team_id=team_id,
        manager_id=manager_id,
        is_active=True,
    )
    db.add(user)
    db.flush()
    print(f"[seed] Usuario creado: {email} ({role.value})")
    return user


def _ensure_balance(db, *, user_id, year: int, available_days: Decimal, used_days: Decimal) -> VacationBalance:
    existing = db.execute(
        select(VacationBalance).where(VacationBalance.user_id == user_id, VacationBalance.year == year)
    ).scalar_one_or_none()

    if existing:
        print(f"[seed] Balance existente para user_id={user_id}, year={year}")
        return existing

    balance = VacationBalance(
        user_id=user_id,
        year=year,
        available_days=available_days,
        used_days=used_days,
        version=1,
    )
    db.add(balance)
    db.flush()
    print(
        f"[seed] Balance creado para user_id={user_id}, year={year}, "
        f"available={available_days}, used={used_days}"
    )
    return balance


def _ensure_team(db, *, name: str) -> Team:
    existing = db.execute(select(Team).where(Team.name == name)).scalar_one_or_none()
    if existing:
        print(f"[seed] Team existente: {name}")
        return existing

    team = Team(name=name, is_active=True)
    db.add(team)
    db.flush()
    print(f"[seed] Team creado: {name}")
    return team


def _ensure_team_policy(
    db,
    *,
    team_id,
    created_by,
    max_people_off_per_day: int,
    min_notice_days: int,
) -> TeamPolicy:
    existing = db.execute(
        select(TeamPolicy)
        .where(TeamPolicy.team_id == team_id)
        .order_by(TeamPolicy.effective_from.desc(), TeamPolicy.id.desc())
    ).scalars().first()

    if existing:
        print(f"[seed] Política de team existente para team_id={team_id}")
        return existing

    policy = TeamPolicy(
        team_id=team_id,
        created_by=created_by,
        max_people_off_per_day=max_people_off_per_day,
        min_notice_days=min_notice_days,
        effective_from=datetime.now(timezone.utc).date(),
        effective_to=None,
    )
    db.add(policy)
    db.flush()
    print(
        f"[seed] Política team creada: team_id={team_id}, max_off={max_people_off_per_day}, min_notice={min_notice_days}"
    )
    return policy


def run() -> None:
    print("[seed] Iniciando seed MVP...")
    with SessionLocal() as db:
        with db.begin():
            team = _ensure_team(db, name="Equipo General")

            admin = _ensure_user(
                db,
                email="admin@vacaciones.local",
                full_name="Admin Principal",
                role=UserRole.ADMIN,
                password_plain="Admin123!",
                team_id=team.id,
            )

            manager = _ensure_user(
                db,
                email="manager@vacaciones.local",
                full_name="Manager Equipo",
                role=UserRole.MANAGER,
                password_plain="Manager123!",
                team_id=team.id,
                manager_id=admin.id,
            )

            employee = _ensure_user(
                db,
                email="employee@vacaciones.local",
                full_name="Empleado Demo",
                role=UserRole.EMPLOYEE,
                password_plain="Employee123!",
                team_id=team.id,
                manager_id=manager.id,
            )

            _ensure_team_policy(
                db,
                team_id=team.id,
                created_by=admin.id,
                max_people_off_per_day=2,
                min_notice_days=10,
            )

            _ensure_balance(
                db,
                user_id=employee.id,
                year=SEED_YEAR,
                available_days=Decimal("15.00"),
                used_days=Decimal("0.00"),
            )

            emmanuel = _ensure_user(
                db,
                email="emmanuel@seekop.com",
                full_name="Emmanuel Seekop",
                role=UserRole.EMPLOYEE,
                password_plain="1234",
                team_id=team.id,
                manager_id=manager.id,
            )

            ricardo = _ensure_user(
                db,
                email="ricardo@seekop.com",
                full_name="Ricardo Seekop",
                role=UserRole.EMPLOYEE,
                password_plain="1234",
                team_id=team.id,
                manager_id=manager.id,
            )

            _ensure_balance(
                db,
                user_id=emmanuel.id,
                year=SEED_YEAR,
                available_days=Decimal("15.00"),
                used_days=Decimal("0.00"),
            )

            _ensure_balance(
                db,
                user_id=ricardo.id,
                year=SEED_YEAR,
                available_days=Decimal("15.00"),
                used_days=Decimal("0.00"),
            )

            hr_user = _ensure_user(
                db,
                email="hr@seekop.com",
                full_name="RRHH Seekop",
                role=UserRole.HR,
                password_plain="1234",
                team_id=team.id,
            )

            _ensure_balance(
                db,
                user_id=manager.id,
                year=SEED_YEAR,
                available_days=Decimal("15.00"),
                used_days=Decimal("0.00"),
            )

    print("[seed] Seed MVP completado.")
    print("[seed] Credenciales de prueba:")
    print("  - admin@vacaciones.local / Admin123!")
    print("  - manager@vacaciones.local / Manager123!")
    print("  - employee@vacaciones.local / Employee123!")
    print("  - emmanuel@seekop.com / 1234")
    print("  - ricardo@seekop.com / 1234")
    print("  - hr@seekop.com / 1234 (HR read-only)")


if __name__ == "__main__":
    run()
