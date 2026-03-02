from __future__ import annotations

from datetime import date, datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.schemas.auth import UserSummary
from app.services.team_policy_agent_service import TeamPolicyAgentService
from app.services.vacation_request_service import VacationRequestService


client = TestClient(app)


def test_team_policy_agent_forbidden_for_employee() -> None:
    def _employee_user() -> UserSummary:
        return UserSummary(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            full_name="Empleado Test",
            role="EMPLOYEE",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    app.dependency_overrides[get_current_user] = _employee_user

    response = client.post(
        "/api/v1/team-policies/agent",
        json={"instruction": "máximo 2 personas fuera y 10 días de anticipación", "apply": False},
    )

    assert response.status_code == 403
    app.dependency_overrides.clear()


def test_team_policy_agent_proposal_mode(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    def _fake_propose(self, actor_id: str, instruction: str, requested_team_id, effective_from, effective_to):
        assert actor_id == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        assert "anticipación" in instruction or "anticipacion" in instruction.lower()
        return SimpleNamespace(
            team_id="99999999-9999-9999-9999-999999999999",
            max_people_off_per_day=2,
            min_notice_days=10,
            effective_from=date(2026, 3, 1),
            effective_to=None,
            confidence="high",
            notes=["Parámetros detectados directamente de la instrucción del manager/admin."],
        )

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(TeamPolicyAgentService, "propose", _fake_propose)

    response = client.post(
        "/api/v1/team-policies/agent",
        json={
            "instruction": "poner maximo 2 personas fuera por día y 10 días de anticipación",
            "apply": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is False
    assert body["proposal"]["max_people_off_per_day"] == 2
    assert body["proposal"]["min_notice_days"] == 10
    app.dependency_overrides.clear()


def test_team_policy_agent_apply_mode(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    def _fake_propose(self, actor_id: str, instruction: str, requested_team_id, effective_from, effective_to):
        return SimpleNamespace(
            team_id="99999999-9999-9999-9999-999999999999",
            max_people_off_per_day=3,
            min_notice_days=12,
            effective_from=date(2026, 3, 1),
            effective_to=None,
            confidence="high",
            notes=["Parámetros detectados directamente de la instrucción del manager/admin."],
        )

    def _fake_upsert(
        self,
        actor_id: str,
        team_id: str,
        max_people_off_per_day: int,
        min_notice_days: int,
        effective_from: date,
        effective_to,
    ):
        assert actor_id == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        assert team_id == "99999999-9999-9999-9999-999999999999"
        assert max_people_off_per_day == 3
        assert min_notice_days == 12
        return SimpleNamespace(
            id=77,
            team_id=team_id,
            max_people_off_per_day=max_people_off_per_day,
            min_notice_days=min_notice_days,
            effective_from=effective_from,
            effective_to=effective_to,
            created_by="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            created_at=datetime.now(timezone.utc),
        )

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(TeamPolicyAgentService, "propose", _fake_propose)
    monkeypatch.setattr(VacationRequestService, "upsert_team_policy", _fake_upsert)

    response = client.post(
        "/api/v1/team-policies/agent",
        json={
            "instruction": "sube a 3 personas fuera y 12 días de anticipación",
            "apply": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is True
    assert body["policy"]["max_people_off_per_day"] == 3
    assert body["policy"]["min_notice_days"] == 12
    app.dependency_overrides.clear()
