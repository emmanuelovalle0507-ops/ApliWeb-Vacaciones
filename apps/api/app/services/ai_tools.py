"""
Role-Based AI Tools — each tool queries real data with scope enforcement.

Tools are callable by the AI chat service. Each declares which roles may invoke it.
The service checks permissions BEFORE calling any tool.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.models.user import User, UserRole
from app.models.vacation_balance import VacationBalance
from app.models.vacation_request import VacationRequest, VacationRequestStatus
from app.models.team import Team
from app.models.team_policy import TeamPolicy

logger = logging.getLogger(__name__)

ROLE_SET = set[str]

@dataclass
class ToolResult:
    tool_name: str
    data: str
    record_count: int = 0


@dataclass
class ToolDef:
    name: str
    description: str
    allowed_roles: ROLE_SET
    parameters: list[dict[str, str]] = field(default_factory=list)


# ── Tool Registry ──────────────────────────────────────────────

TOOL_DEFINITIONS: list[ToolDef] = [
    ToolDef(
        name="get_my_balance",
        description="Obtiene el saldo de vacaciones del usuario actual (días disponibles, usados, otorgados).",
        allowed_roles={"EMPLOYEE", "MANAGER", "ADMIN", "HR"},
        parameters=[{"name": "year", "type": "int", "description": "Año a consultar"}],
    ),
    ToolDef(
        name="list_my_requests",
        description="Lista las solicitudes de vacaciones del usuario actual con su estado.",
        allowed_roles={"EMPLOYEE", "MANAGER"},
        parameters=[],
    ),
    ToolDef(
        name="list_team_requests",
        description="Lista solicitudes de vacaciones del equipo del manager. Puede filtrar por estado.",
        allowed_roles={"MANAGER"},
        parameters=[{"name": "status", "type": "str", "description": "Filtro opcional: PENDING, APPROVED, REJECTED, CANCELLED"}],
    ),
    ToolDef(
        name="list_global_requests",
        description="Lista solicitudes de vacaciones de toda la organización. Puede filtrar por estado.",
        allowed_roles={"ADMIN", "HR"},
        parameters=[{"name": "status", "type": "str", "description": "Filtro opcional: PENDING, APPROVED, REJECTED, CANCELLED"}],
    ),
    ToolDef(
        name="list_employees",
        description="Lista empleados de la organización con su rol, equipo y estado.",
        allowed_roles={"ADMIN", "HR"},
        parameters=[],
    ),
    ToolDef(
        name="list_team_members",
        description="Lista los miembros del equipo del manager.",
        allowed_roles={"MANAGER"},
        parameters=[],
    ),
    ToolDef(
        name="get_team_summary",
        description="Resumen del estado del equipo: empleados activos, personas fuera hoy, solicitudes pendientes.",
        allowed_roles={"MANAGER", "ADMIN", "HR"},
        parameters=[],
    ),
    ToolDef(
        name="get_global_summary",
        description="Resumen global de la organización: total empleados, personas fuera hoy, solicitudes pendientes, balances críticos.",
        allowed_roles={"ADMIN", "HR"},
        parameters=[],
    ),
    ToolDef(
        name="get_policies_by_area",
        description="Obtiene la política de vacaciones vigente de un equipo (capacidad diaria, anticipación mínima).",
        allowed_roles={"MANAGER", "ADMIN", "HR"},
        parameters=[{"name": "year", "type": "int", "description": "Año de referencia (opcional)"}],
    ),
]


def get_tools_for_role(role: str) -> list[ToolDef]:
    return [t for t in TOOL_DEFINITIONS if role in t.allowed_roles]


def get_tool_names_for_role(role: str) -> list[str]:
    return [t.name for t in TOOL_DEFINITIONS if role in t.allowed_roles]


# ── Tool Implementations ───────────────────────────────────────

class AIToolExecutor:
    def __init__(self, db: Session) -> None:
        self.db = db

    @staticmethod
    def _today() -> date:
        return datetime.now(timezone.utc).date()

    def _get_team_name(self, team_id: str | UUID | None) -> str:
        if not team_id:
            return "Sin equipo"
        stmt = select(Team.name).where(Team.id == str(team_id))
        name = self.db.execute(stmt).scalar_one_or_none()
        return name or "Sin equipo"

    # ── get_my_balance ─────────────────────────────────
    def get_my_balance(self, user_id: str, year: int | None = None) -> ToolResult:
        y = year or self._today().year
        stmt = select(VacationBalance).where(
            VacationBalance.user_id == user_id,
            VacationBalance.year == y,
        )
        bal = self.db.execute(stmt).scalar_one_or_none()
        if not bal:
            return ToolResult(tool_name="get_my_balance", data=f"No se encontró balance para el año {y}.")

        available = float(bal.available_days)
        used = float(bal.used_days)
        granted = available + used
        return ToolResult(
            tool_name="get_my_balance",
            data=f"Balance {y}: {granted:.0f} días otorgados, {used:.0f} usados, {available:.0f} disponibles.",
            record_count=1,
        )

    # ── list_my_requests ───────────────────────────────
    def list_my_requests(self, user_id: str) -> ToolResult:
        stmt = (
            select(VacationRequest)
            .where(VacationRequest.employee_id == user_id)
            .order_by(VacationRequest.created_at.desc())
            .limit(10)
        )
        rows = list(self.db.execute(stmt).scalars().all())
        if not rows:
            return ToolResult(tool_name="list_my_requests", data="No tienes solicitudes de vacaciones registradas.")

        lines = []
        for r in rows:
            lines.append(
                f"• {r.start_date} a {r.end_date} ({r.requested_days:.0f} días) — {r.status.value}"
                + (f" — Motivo: {r.reason}" if r.reason else "")
            )
        return ToolResult(
            tool_name="list_my_requests",
            data=f"Tus solicitudes recientes ({len(rows)}):\n" + "\n".join(lines),
            record_count=len(rows),
        )

    # ── list_team_requests ─────────────────────────────
    def list_team_requests(self, manager_id: str, status: str | None = None) -> ToolResult:
        filters = [VacationRequest.manager_id == manager_id]
        if status:
            try:
                st = VacationRequestStatus(status.upper())
                filters.append(VacationRequest.status == st)
            except ValueError:
                pass

        emp_alias = aliased(User)
        stmt = (
            select(VacationRequest, emp_alias.full_name)
            .join(emp_alias, emp_alias.id == VacationRequest.employee_id)
            .where(*filters)
            .order_by(VacationRequest.created_at.desc())
            .limit(15)
        )
        rows = self.db.execute(stmt).all()
        if not rows:
            label = f" con estado {status.upper()}" if status else ""
            return ToolResult(tool_name="list_team_requests", data=f"No hay solicitudes de tu equipo{label}.")

        lines = []
        for req, emp_name in rows:
            lines.append(
                f"• {emp_name}: {req.start_date} a {req.end_date} ({req.requested_days:.0f}d) — {req.status.value}"
            )
        return ToolResult(
            tool_name="list_team_requests",
            data=f"Solicitudes del equipo ({len(rows)}):\n" + "\n".join(lines),
            record_count=len(rows),
        )

    # ── list_global_requests ───────────────────────────
    def list_global_requests(self, status: str | None = None) -> ToolResult:
        filters: list = []
        if status:
            try:
                st = VacationRequestStatus(status.upper())
                filters.append(VacationRequest.status == st)
            except ValueError:
                pass

        emp_alias = aliased(User)
        stmt = (
            select(VacationRequest, emp_alias.full_name)
            .join(emp_alias, emp_alias.id == VacationRequest.employee_id)
            .where(*filters)
            .order_by(VacationRequest.created_at.desc())
            .limit(20)
        )
        rows = self.db.execute(stmt).all()
        if not rows:
            label = f" con estado {status.upper()}" if status else ""
            return ToolResult(tool_name="list_global_requests", data=f"No hay solicitudes globales{label}.")

        lines = []
        for req, emp_name in rows:
            team_name = self._get_team_name(req.team_id)
            lines.append(
                f"• {emp_name} ({team_name}): {req.start_date} a {req.end_date} ({req.requested_days:.0f}d) — {req.status.value}"
            )
        return ToolResult(
            tool_name="list_global_requests",
            data=f"Solicitudes globales ({len(rows)}):\n" + "\n".join(lines),
            record_count=len(rows),
        )

    # ── list_employees ─────────────────────────────────
    def list_employees(self) -> ToolResult:
        stmt = (
            select(User)
            .where(User.is_active.is_(True))
            .order_by(User.full_name)
            .limit(50)
        )
        users = list(self.db.execute(stmt).scalars().all())
        if not users:
            return ToolResult(tool_name="list_employees", data="No hay empleados registrados.")

        lines = []
        for u in users:
            team_name = self._get_team_name(u.team_id)
            lines.append(f"• {u.full_name} — {u.role.value} — {team_name}")
        return ToolResult(
            tool_name="list_employees",
            data=f"Empleados activos ({len(users)}):\n" + "\n".join(lines),
            record_count=len(users),
        )

    # ── list_team_members ──────────────────────────────
    def list_team_members(self, manager_id: str) -> ToolResult:
        stmt = (
            select(User)
            .where(User.manager_id == manager_id, User.is_active.is_(True))
            .order_by(User.full_name)
        )
        members = list(self.db.execute(stmt).scalars().all())
        if not members:
            return ToolResult(tool_name="list_team_members", data="No tienes miembros asignados en tu equipo.")

        lines = [f"• {m.full_name} ({m.email})" for m in members]
        return ToolResult(
            tool_name="list_team_members",
            data=f"Miembros de tu equipo ({len(members)}):\n" + "\n".join(lines),
            record_count=len(members),
        )

    # ── get_team_summary ───────────────────────────────
    def get_team_summary(self, team_id: str | None = None, manager_id: str | None = None) -> ToolResult:
        today = self._today()

        emp_filters = [User.is_active.is_(True)]
        req_team_filters: list = []
        if team_id:
            emp_filters.append(User.team_id == team_id)
            req_team_filters.append(VacationRequest.team_id == team_id)
        elif manager_id:
            emp_filters.append(User.manager_id == manager_id)
            req_team_filters.append(VacationRequest.manager_id == manager_id)

        total = int(self.db.execute(select(func.count(User.id)).where(*emp_filters)).scalar_one() or 0)

        out_filters = [
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= today,
            VacationRequest.end_date >= today,
        ] + req_team_filters
        out_today = int(self.db.execute(select(func.count(VacationRequest.id)).where(*out_filters)).scalar_one() or 0)

        pending_filters = [VacationRequest.status == VacationRequestStatus.PENDING] + req_team_filters
        pending = int(self.db.execute(select(func.count(VacationRequest.id)).where(*pending_filters)).scalar_one() or 0)

        available = max(total - out_today, 0)
        team_label = self._get_team_name(team_id) if team_id else "tu equipo"

        return ToolResult(
            tool_name="get_team_summary",
            data=(
                f"Resumen de {team_label}: {total} empleados activos, "
                f"{available} disponibles hoy, {out_today} fuera hoy, "
                f"{pending} solicitudes pendientes."
            ),
            record_count=1,
        )

    # ── get_global_summary ─────────────────────────────
    def get_global_summary(self) -> ToolResult:
        today = self._today()
        year = today.year

        total_emp = int(self.db.execute(
            select(func.count(User.id)).where(User.is_active.is_(True))
        ).scalar_one() or 0)

        out_today = int(self.db.execute(
            select(func.count(VacationRequest.id)).where(
                VacationRequest.status == VacationRequestStatus.APPROVED,
                VacationRequest.start_date <= today,
                VacationRequest.end_date >= today,
            )
        ).scalar_one() or 0)

        pending = int(self.db.execute(
            select(func.count(VacationRequest.id)).where(
                VacationRequest.status == VacationRequestStatus.PENDING,
            )
        ).scalar_one() or 0)

        # Low balance warning (< 3 days)
        low_bal_stmt = (
            select(User.full_name, VacationBalance.available_days)
            .join(User, User.id == VacationBalance.user_id)
            .where(VacationBalance.year == year, VacationBalance.available_days < 3)
            .order_by(VacationBalance.available_days.asc())
            .limit(5)
        )
        low_bal_rows = self.db.execute(low_bal_stmt).all()
        low_bal_text = ""
        if low_bal_rows:
            items = [f"{name} ({float(days):.0f}d)" for name, days in low_bal_rows]
            low_bal_text = f"\nEmpleados con saldo bajo (<3 días): {', '.join(items)}."

        return ToolResult(
            tool_name="get_global_summary",
            data=(
                f"Resumen global: {total_emp} empleados activos, "
                f"{out_today} fuera hoy, {pending} solicitudes pendientes."
                f"{low_bal_text}"
            ),
            record_count=1,
        )

    # ── get_policies_by_area ─────────────────────────
    def get_policies_by_area(self, team_id: str | None = None) -> ToolResult:
        today = self._today()
        if not team_id:
            return ToolResult(tool_name="get_policies_by_area", data="No se especificó equipo para consultar política.")

        stmt = (
            select(TeamPolicy)
            .where(
                TeamPolicy.team_id == team_id,
                TeamPolicy.effective_from <= today,
                (TeamPolicy.effective_to.is_(None) | (TeamPolicy.effective_to >= today)),
            )
            .order_by(TeamPolicy.effective_from.desc())
            .limit(1)
        )
        policy = self.db.execute(stmt).scalar_one_or_none()
        if not policy:
            team_name = self._get_team_name(team_id)
            return ToolResult(tool_name="get_policies_by_area", data=f"No hay política activa para {team_name}.")

        team_name = self._get_team_name(team_id)
        return ToolResult(
            tool_name="get_policies_by_area",
            data=(
                f"Política activa de {team_name}: máximo {policy.max_people_off_per_day} personas fuera por día, "
                f"mínimo {policy.min_notice_days} días de anticipación. "
                f"Vigente desde {policy.effective_from}."
            ),
            record_count=1,
        )

    # ── Dispatcher ─────────────────────────────────────
    def execute(self, tool_name: str, role: str, user_id: str, team_id: str | None, **kwargs: Any) -> ToolResult:
        # Permission check
        tool_def = next((t for t in TOOL_DEFINITIONS if t.name == tool_name), None)
        if not tool_def:
            return ToolResult(tool_name=tool_name, data=f"Herramienta '{tool_name}' no encontrada.")
        if role not in tool_def.allowed_roles:
            return ToolResult(tool_name=tool_name, data="No tienes permiso para usar esta herramienta.")

        try:
            if tool_name == "get_my_balance":
                return self.get_my_balance(user_id, kwargs.get("year"))
            elif tool_name == "list_my_requests":
                return self.list_my_requests(user_id)
            elif tool_name == "list_team_requests":
                return self.list_team_requests(user_id, kwargs.get("status"))
            elif tool_name == "list_global_requests":
                return self.list_global_requests(kwargs.get("status"))
            elif tool_name == "list_employees":
                return self.list_employees()
            elif tool_name == "list_team_members":
                return self.list_team_members(user_id)
            elif tool_name == "get_team_summary":
                return self.get_team_summary(team_id=team_id, manager_id=user_id)
            elif tool_name == "get_global_summary":
                return self.get_global_summary()
            elif tool_name == "get_policies_by_area":
                return self.get_policies_by_area(team_id=team_id)
            else:
                return ToolResult(tool_name=tool_name, data="Herramienta no implementada.")
        except Exception as exc:
            logger.exception("Tool execution error: %s", tool_name)
            return ToolResult(tool_name=tool_name, data=f"Error al ejecutar herramienta: {exc}")
