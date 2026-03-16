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
from app.models.user_manager import UserManager  # noqa: F401 – needed for relationship resolution
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
    print("[seed] Iniciando seed para presentación...")
    with SessionLocal() as db:
        with db.begin():
            # ── Equipos ──
            team_ia = _ensure_team(db, name="Desarrollo de IA")
            team_mkt = _ensure_team(db, name="Marketing Digital")
            team_ops = _ensure_team(db, name="Operaciones")

            # ── ADMIN ──
            admin = _ensure_user(
                db,
                email="RicardoB@seekop.com",
                full_name="Ricardo Seekop",
                role=UserRole.ADMIN,
                password_plain="Seekop2026!",
                team_id=team_ia.id,
            )

            # ── MANAGERS ──
            josue = _ensure_user(
                db,
                email="JosueO@seekop.com",
                full_name="Josue Ovalle",
                role=UserRole.MANAGER,
                password_plain="Seekop2026!",
                team_id=team_ia.id,
                manager_id=admin.id,
            )

            daniela = _ensure_user(
                db,
                email="DanielaR@seekop.com",
                full_name="Daniela Ríos",
                role=UserRole.MANAGER,
                password_plain="Seekop2026!",
                team_id=team_mkt.id,
                manager_id=admin.id,
            )

            andres = _ensure_user(
                db,
                email="AndresM@seekop.com",
                full_name="Andrés Mendoza",
                role=UserRole.MANAGER,
                password_plain="Seekop2026!",
                team_id=team_ops.id,
                manager_id=admin.id,
            )

            # ── EMPLEADOS — Desarrollo de IA (jefe: Josue) ──
            ricardo_n = _ensure_user(
                db,
                email="RicardoN@seekop.com",
                full_name="Ricardo Nieto",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_ia.id,
                manager_id=josue.id,
            )

            emmanuel = _ensure_user(
                db,
                email="EmmanuelS@seekop.com",
                full_name="Emmanuel Salas",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_ia.id,
                manager_id=josue.id,
            )

            # ── EMPLEADOS — Marketing Digital (jefa: Daniela) ──
            sofia = _ensure_user(
                db,
                email="SofiaV@seekop.com",
                full_name="Sofía Vargas",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_mkt.id,
                manager_id=daniela.id,
            )

            carlos = _ensure_user(
                db,
                email="CarlosL@seekop.com",
                full_name="Carlos López",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_mkt.id,
                manager_id=daniela.id,
            )

            # ── EMPLEADOS — Operaciones (jefe: Andrés) ──
            maria = _ensure_user(
                db,
                email="MariaG@seekop.com",
                full_name="María García",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_ops.id,
                manager_id=andres.id,
            )

            pedro = _ensure_user(
                db,
                email="PedroH@seekop.com",
                full_name="Pedro Hernández",
                role=UserRole.EMPLOYEE,
                password_plain="Seekop2026!",
                team_id=team_ops.id,
                manager_id=andres.id,
            )

            # ── HR ──
            hr_user = _ensure_user(
                db,
                email="MonicaT@seekop.com",
                full_name="Mónica Torres",
                role=UserRole.HR,
                password_plain="Seekop2026!",
                team_id=team_ia.id,
            )

            # ── FINANCE ──
            finance_user = _ensure_user(
                db,
                email="LuisF@seekop.com",
                full_name="Luis Fernández",
                role=UserRole.FINANCE,
                password_plain="Seekop2026!",
                team_id=team_ops.id,
            )

            # ── Políticas de equipo ──
            _ensure_team_policy(db, team_id=team_ia.id, created_by=admin.id, max_people_off_per_day=2, min_notice_days=10)
            _ensure_team_policy(db, team_id=team_mkt.id, created_by=admin.id, max_people_off_per_day=1, min_notice_days=7)
            _ensure_team_policy(db, team_id=team_ops.id, created_by=admin.id, max_people_off_per_day=2, min_notice_days=5)

            # ── Balances ──
            all_users_with_balance = [
                (admin, Decimal("20.00"), Decimal("2.00")),
                (josue, Decimal("18.00"), Decimal("3.00")),
                (daniela, Decimal("18.00"), Decimal("5.00")),
                (andres, Decimal("18.00"), Decimal("0.00")),
                (ricardo_n, Decimal("15.00"), Decimal("4.00")),
                (emmanuel, Decimal("15.00"), Decimal("2.00")),
                (sofia, Decimal("15.00"), Decimal("6.00")),
                (carlos, Decimal("15.00"), Decimal("0.00")),
                (maria, Decimal("15.00"), Decimal("3.00")),
                (pedro, Decimal("15.00"), Decimal("1.00")),
                (hr_user, Decimal("15.00"), Decimal("0.00")),
                (finance_user, Decimal("15.00"), Decimal("0.00")),
            ]
            for user, available, used in all_users_with_balance:
                _ensure_balance(db, user_id=user.id, year=SEED_YEAR, available_days=available, used_days=used)

    print()
    print("[seed] Seed completado OK.")
    print()
    print("[seed] +--------------------------------------------------------------+")
    print("[seed] |          CREDENCIALES PARA PRESENTACION                     |")
    print("[seed] |  (Todos usan password: Seekop2026!)                         |")
    print("[seed] +--------------------------------------------------------------+")
    print("[seed] |  ADMIN                                                      |")
    print("[seed] |    RicardoB@seekop.com      Ricardo Seekop                  |")
    print("[seed] |  MANAGERS                                                   |")
    print("[seed] |    JosueO@seekop.com        Josue Ovalle (Desarrollo IA)    |")
    print("[seed] |    DanielaR@seekop.com      Daniela Rios (Marketing)        |")
    print("[seed] |    AndresM@seekop.com       Andres Mendoza (Operaciones)    |")
    print("[seed] |  EMPLEADOS - Desarrollo de IA                               |")
    print("[seed] |    RicardoN@seekop.com      Ricardo Nieto                   |")
    print("[seed] |    EmmanuelS@seekop.com     Emmanuel Salas                  |")
    print("[seed] |  EMPLEADOS - Marketing Digital                              |")
    print("[seed] |    SofiaV@seekop.com        Sofia Vargas                    |")
    print("[seed] |    CarlosL@seekop.com       Carlos Lopez                    |")
    print("[seed] |  EMPLEADOS - Operaciones                                    |")
    print("[seed] |    MariaG@seekop.com        Maria Garcia                    |")
    print("[seed] |    PedroH@seekop.com        Pedro Hernandez                 |")
    print("[seed] |  HR                                                         |")
    print("[seed] |    MonicaT@seekop.com       Monica Torres                   |")
    print("[seed] |  FINANCE                                                    |")
    print("[seed] |    LuisF@seekop.com         Luis Fernandez                  |")
    print("[seed] +--------------------------------------------------------------+")


if __name__ == "__main__":
    run()
