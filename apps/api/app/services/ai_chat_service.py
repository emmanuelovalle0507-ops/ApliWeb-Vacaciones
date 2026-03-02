from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, not_, select
from sqlalchemy.orm import Session, aliased

from app.models.ai_chat_interaction import AIChatInteraction
from app.models.user import User, UserRole
from app.models.vacation_request import VacationRequest, VacationRequestStatus
from app.repositories.ai_chat_repo import AIChatRepository
from app.repositories.user_repo import UserRepository
from app.services.llm_service import LLMService


@dataclass
class AIAnswer:
    answer: str
    scope: str


class AIChatService:
    DOMAIN_HINT = (
        "Solo puedo responder preguntas sobre la aplicación de vacaciones "
        "(equipos, solicitudes, disponibilidad, aprobaciones, rechazos, saldos y políticas)."
    )

    def __init__(self, db: Session) -> None:
        self.db = db
        self.chat_repo = AIChatRepository(db)
        self.user_repo = UserRepository(db)
        self.llm = LLMService()

    @staticmethod
    def _today() -> date:
        return datetime.now(timezone.utc).date()

    def _resolve_scope(self, actor_id: str) -> tuple[User, str, UUID | None]:
        actor = self.user_repo.get_by_id(actor_id)
        if not actor:
            raise ValueError("User not found")

        if actor.role == UserRole.EMPLOYEE:
            raise PermissionError("Only manager/admin can use AI chat")

        if actor.role == UserRole.MANAGER:
            if not actor.team_id:
                raise ValueError("Manager has no assigned team")
            return actor, "TEAM", actor.team_id

        return actor, "GLOBAL", None

    @staticmethod
    def _is_domain_question(question: str) -> bool:
        q = question.lower()
        keywords = [
            "vacaci",
            "solicitud",
            "equipo",
            "disponib",
            "aprob",
            "rechaz",
            "saldo",
            "política",
            "politica",
            "capacidad",
            "emplead",
            "manager",
            "admin",
            "ausen",
            "siguiente mes",
            "próximo mes",
            "proximo mes",
        ]
        return any(k in q for k in keywords)

    def _format_people(self, names: list[str]) -> str:
        if not names:
            return "Nadie"
        if len(names) <= 8:
            return ", ".join(names)
        preview = ", ".join(names[:8])
        return f"{preview} (+{len(names) - 8} más)"

    def _team_summary(self, team_id: UUID | None) -> str:
        today = self._today()
        employee_filters = [User.role == UserRole.EMPLOYEE, User.is_active.is_(True)]
        if team_id:
            employee_filters.append(User.team_id == team_id)

        employee_stmt = select(func.count(User.id)).where(*employee_filters)
        total_employees = int(self.db.execute(employee_stmt).scalar_one() or 0)

        request_filters = [
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= today,
            VacationRequest.end_date >= today,
        ]
        if team_id:
            request_filters.append(VacationRequest.team_id == team_id)

        approved_today_stmt = select(func.count(VacationRequest.id)).where(*request_filters)
        approved_today = int(self.db.execute(approved_today_stmt).scalar_one() or 0)
        available_today = max(total_employees - approved_today, 0)

        pending_filters = [VacationRequest.status == VacationRequestStatus.PENDING]
        if team_id:
            pending_filters.append(VacationRequest.team_id == team_id)

        pending_stmt = select(func.count(VacationRequest.id)).where(*pending_filters)
        pending = int(self.db.execute(pending_stmt).scalar_one() or 0)

        return (
            f"Estado actual: empleados activos={total_employees}, disponibles hoy={available_today}, "
            f"fuera hoy={approved_today}, solicitudes pendientes={pending}."
        )

    def _who_is_available(self, team_id: UUID | None) -> str:
        today = self._today()
        out_filters = [
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= today,
            VacationRequest.end_date >= today,
        ]
        if team_id:
            out_filters.append(VacationRequest.team_id == team_id)

        out_stmt = select(VacationRequest.employee_id).where(*out_filters)
        out_ids = [row[0] for row in self.db.execute(out_stmt).all()]

        employee_filters = [User.role == UserRole.EMPLOYEE, User.is_active.is_(True)]
        if team_id:
            employee_filters.append(User.team_id == team_id)
        if out_ids:
            employee_filters.append(not_(User.id.in_(out_ids)))

        employee_stmt = select(User.full_name).where(*employee_filters)
        names = [row[0] for row in self.db.execute(employee_stmt).all()]
        return f"Disponibles hoy: {self._format_people(names)}."

    def _next_month_out(self, team_id: UUID | None) -> str:
        today = self._today()
        year = today.year + (1 if today.month == 12 else 0)
        month = 1 if today.month == 12 else today.month + 1
        next_month_start = date(year, month, 1)
        next_month_end = date(year, month, 28)
        while True:
            try:
                next_month_end = date(year, month, next_month_end.day + 1)
            except ValueError:
                break

        employee_alias = aliased(User)
        next_month_filters = [
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= next_month_end,
            VacationRequest.end_date >= next_month_start,
        ]
        if team_id:
            next_month_filters.append(VacationRequest.team_id == team_id)

        stmt = (
            select(employee_alias.full_name, VacationRequest.start_date, VacationRequest.end_date)
            .join(employee_alias, employee_alias.id == VacationRequest.employee_id)
            .where(*next_month_filters)
            .order_by(VacationRequest.start_date.asc())
            .limit(10)
        )
        rows = self.db.execute(stmt).all()
        if not rows:
            return "No hay personas con vacaciones aprobadas para el siguiente mes."

        details = "; ".join([f"{name} ({start} a {end})" for name, start, end in rows])
        return f"Próximo mes no estarán: {details}."

    def _approval_details(self, team_id: UUID | None, approved: bool) -> str:
        manager_alias = aliased(User)
        employee_alias = aliased(User)
        status_value = VacationRequestStatus.APPROVED if approved else VacationRequestStatus.REJECTED

        approval_filters = [VacationRequest.status == status_value]
        if team_id:
            approval_filters.append(VacationRequest.team_id == team_id)

        stmt = (
            select(
                employee_alias.full_name,
                manager_alias.full_name,
                VacationRequest.decision_comment,
                VacationRequest.reason,
                VacationRequest.updated_at,
            )
            .join(employee_alias, employee_alias.id == VacationRequest.employee_id)
            .join(manager_alias, manager_alias.id == VacationRequest.manager_id)
            .where(*approval_filters)
            .order_by(VacationRequest.updated_at.desc())
            .limit(5)
        )
        rows = self.db.execute(stmt).all()
        if not rows:
            if approved:
                return "No hay aprobaciones registradas en el alcance actual."
            return "No hay rechazos registrados en el alcance actual."

        label = "Aprobaciones" if approved else "Rechazos"
        chunks: list[str] = []
        for employee_name, manager_name, decision_comment, reason, _updated_at in rows:
            reason_text = reason or "sin motivo del empleado"
            comment_text = decision_comment or "sin comentario del aprobador"
            chunks.append(
                f"{employee_name} por {manager_name} (motivo empleado: {reason_text}; comentario decisión: {comment_text})"
            )

        return f"{label} recientes: " + " | ".join(chunks)

    def _build_answer(self, question: str, team_id: UUID | None) -> str:
        q = question.lower()

        if not self._is_domain_question(question):
            return self.DOMAIN_HINT

        if any(token in q for token in ["estado", "resumen", "equipo actual"]):
            return self._team_summary(team_id)

        if "disponib" in q and "qu" in q:
            return self._who_is_available(team_id)

        if ("siguiente mes" in q or "próximo mes" in q or "proximo mes" in q) and (
            "no" in q or "fuera" in q or "vacaci" in q
        ):
            return self._next_month_out(team_id)

        if "aprob" in q and "no aprob" not in q and "rechaz" not in q:
            return self._approval_details(team_id, approved=True)

        if "rechaz" in q or "no aprob" in q:
            return self._approval_details(team_id, approved=False)

        if "por qu" in q or "porque" in q:
            return (
                "Puedo explicarte por solicitud los motivos del empleado y comentarios de aprobación/rechazo. "
                "Pregunta, por ejemplo: '¿por qué aprobaron recientemente?' o '¿por qué rechazaron recientemente?'."
            )

        return self._team_summary(team_id)

    def _build_context_snapshot(self, team_id: UUID | None) -> str:
        parts = [
            self._team_summary(team_id),
            self._who_is_available(team_id),
            self._next_month_out(team_id),
            self._approval_details(team_id, approved=True),
            self._approval_details(team_id, approved=False),
        ]
        return "\n".join(parts)

    def ask(self, actor_id: str, question: str) -> AIAnswer:
        _actor, scope, team_id = self._resolve_scope(actor_id)

        fallback_answer = self._build_answer(question, team_id)
        if self._is_domain_question(question):
            context = self._build_context_snapshot(team_id)
            llm_answer = self.llm.answer_domain_question(
                question=question,
                scope=scope,
                context=context,
                domain_hint=self.DOMAIN_HINT,
            )
            answer = llm_answer or fallback_answer
        else:
            answer = fallback_answer

        self.chat_repo.add(
            AIChatInteraction(
                actor_user_id=UUID(actor_id),
                scope=scope,
                question=question,
                answer=answer,
            )
        )
        self.db.commit()
        return AIAnswer(answer=answer, scope=scope)

    def history(self, actor_id: str, limit: int = 20) -> list[AIChatInteraction]:
        _actor, _scope, _team_id = self._resolve_scope(actor_id)
        return self.chat_repo.list_recent_by_actor(actor_id=actor_id, limit=limit)
