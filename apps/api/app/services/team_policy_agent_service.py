from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.repositories.team_policy_repo import TeamPolicyRepository
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.services.llm_service import LLMService


@dataclass
class AgentPolicyProposal:
    team_id: str
    max_people_off_per_day: int
    min_notice_days: int
    effective_from: date
    effective_to: date | None
    confidence: str
    notes: list[str]


class TeamPolicyAgentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.team_repo = TeamRepository(db)
        self.policy_repo = TeamPolicyRepository(db)
        self.llm = LLMService()

    @staticmethod
    def _today() -> date:
        return datetime.now(timezone.utc).date()

    @staticmethod
    def _extract_first_int(patterns: list[str], text: str) -> int | None:
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None

    def _resolve_target_team(self, actor_id: str, requested_team_id: str | None) -> tuple[User, str]:
        actor = self.user_repo.get_by_id(actor_id)
        if not actor:
            raise ValueError("User not found")

        if requested_team_id:
            if actor.role != UserRole.ADMIN and str(actor.team_id) != requested_team_id:
                raise PermissionError("Manager can only configure own team")
            return actor, requested_team_id

        if not actor.team_id:
            raise ValueError("Team id is required for this user")
        return actor, str(actor.team_id)

    def _employee_count(self, team_id: str) -> int:
        stmt = select(func.count(User.id)).where(
            User.role == UserRole.EMPLOYEE,
            User.team_id == team_id,
            User.is_active.is_(True),
        )
        return int(self.db.execute(stmt).scalar_one() or 0)

    def propose(
        self,
        actor_id: str,
        instruction: str,
        requested_team_id: str | None,
        effective_from: date | None,
        effective_to: date | None,
    ) -> AgentPolicyProposal:
        actor, team_id = self._resolve_target_team(actor_id, requested_team_id)
        if not self.team_repo.get_by_id(team_id):
            raise ValueError("Team not found")

        text = instruction.strip()
        if not text:
            raise ValueError("Instruction cannot be empty")

        today = self._today()
        current_policy = self.policy_repo.get_active_for_date(team_id, today)
        employees = self._employee_count(team_id)

        capacity_patterns = [
            r"(?:maximo|máximo)\s*(?:de\s*)?(\d+)\s*(?:personas|empleados)?.*(?:fuera|día|dia)",
            r"(\d+)\s*(?:personas|empleados)\s*(?:fuera|al mismo tiempo|por día|por dia)",
            r"capacidad\s*(?:de\s*)?(\d+)",
        ]
        notice_patterns = [
            r"(?:anticipaci[oó]n\s*m[ií]nima|minimo|minimo\s*de|mínimo|mínimo\s*de)\s*(?:de\s*)?(\d+)\s*d[ií]as",
            r"(\d+)\s*d[ií]as\s*(?:de\s*)?anticipaci[oó]n",
            r"aviso\s*(?:de\s*)?(\d+)\s*d[ií]as",
        ]

        requested_capacity = self._extract_first_int(capacity_patterns, text)
        requested_notice = self._extract_first_int(notice_patterns, text)

        llm_payload = self.llm.propose_policy(
            instruction=text,
            current_policy={
                "max_people_off_per_day": current_policy.max_people_off_per_day if current_policy else None,
                "min_notice_days": current_policy.min_notice_days if current_policy else None,
            },
            employees=employees,
        )
        if llm_payload and requested_capacity is None:
            llm_capacity = llm_payload.get("max_people_off_per_day")
            if isinstance(llm_capacity, int):
                requested_capacity = llm_capacity
        if llm_payload and requested_notice is None:
            llm_notice = llm_payload.get("min_notice_days")
            if isinstance(llm_notice, int):
                requested_notice = llm_notice

        base_capacity = current_policy.max_people_off_per_day if current_policy else max(1, min(5, employees // 3 or 1))
        base_notice = current_policy.min_notice_days if current_policy else 10

        max_people_off_per_day = requested_capacity if requested_capacity is not None else base_capacity
        min_notice_days = requested_notice if requested_notice is not None else base_notice

        if max_people_off_per_day <= 0:
            raise ValueError("max_people_off_per_day must be greater than 0")
        if min_notice_days < 0:
            raise ValueError("min_notice_days must be non-negative")

        proposal_effective_from = effective_from or today
        if effective_to and effective_to < proposal_effective_from:
            raise ValueError("Invalid policy effective date range")

        confidence = "high" if requested_capacity is not None and requested_notice is not None else "medium"
        if llm_payload and isinstance(llm_payload.get("confidence"), str):
            maybe_confidence = str(llm_payload["confidence"]).lower()
            if maybe_confidence in {"low", "medium", "high"}:
                confidence = maybe_confidence
        notes: list[str] = []
        if requested_capacity is None:
            notes.append("No se detectó capacidad explícita; se usó valor actual/recomendado del equipo.")
        if requested_notice is None:
            notes.append("No se detectó anticipación mínima explícita; se usó valor actual/recomendado del equipo.")
        if not notes:
            notes.append("Parámetros detectados directamente de la instrucción del manager/admin.")
        if llm_payload and isinstance(llm_payload.get("notes"), list):
            llm_notes = [n for n in llm_payload["notes"] if isinstance(n, str) and n.strip()]
            notes.extend(llm_notes)

        if actor.role == UserRole.MANAGER:
            notes.append("Alcance aplicado: solo tu equipo.")
        else:
            notes.append("Alcance aplicado: equipo objetivo indicado por admin.")

        return AgentPolicyProposal(
            team_id=team_id,
            max_people_off_per_day=max_people_off_per_day,
            min_notice_days=min_notice_days,
            effective_from=proposal_effective_from,
            effective_to=effective_to,
            confidence=confidence,
            notes=notes,
        )

    def onboarding_questions(self, actor_id: str, requested_team_id: str | None = None) -> tuple[str, bool, list[str]]:
        _actor, team_id = self._resolve_target_team(actor_id, requested_team_id)
        if not self.team_repo.get_by_id(team_id):
            raise ValueError("Team not found")

        has_active_policy = self.policy_repo.get_active_for_date(team_id, self._today()) is not None
        if has_active_policy:
            return team_id, True, []

        employees = self._employee_count(team_id)
        team = self.team_repo.get_by_id(team_id)
        team_name = team.name if team else "Equipo"

        llm_questions = self.llm.onboarding_questions(team_name=team_name, employees=employees)
        if llm_questions:
            return team_id, False, llm_questions

        fallback = [
            "¿Cuál es el máximo de personas que pueden estar fuera el mismo día en tu equipo?",
            "¿Con cuántos días mínimos de anticipación deben pedir vacaciones?",
            "¿Quieres que la política entre en vigor desde hoy o desde una fecha específica?",
        ]
        return team_id, False, fallback
