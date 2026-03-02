from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.schemas.auth import UserSummary
from app.services.ai_chat_service import AIAnswer, AIChatService


client = TestClient(app)


def test_ai_chat_requires_token() -> None:
    response = client.post("/api/v1/ai/chat", json={"question": "estado del equipo"})
    assert response.status_code == 401


def test_ai_chat_forbidden_for_employee() -> None:
    def _employee_user() -> UserSummary:
        return UserSummary(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            full_name="Empleado Test",
            role="EMPLOYEE",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    app.dependency_overrides[get_current_user] = _employee_user

    response = client.post("/api/v1/ai/chat", json={"question": "estado del equipo"})

    assert response.status_code == 403
    app.dependency_overrides.clear()


def test_ai_chat_manager_allowed(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    def _fake_ask(self, actor_id: str, question: str) -> AIAnswer:
        assert actor_id == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        assert question
        return AIAnswer(answer="Estado actual: empleados activos=4, disponibles hoy=3", scope="TEAM")

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(AIChatService, "ask", _fake_ask)

    response = client.post("/api/v1/ai/chat", json={"question": "estado del equipo"})

    assert response.status_code == 200
    body = response.json()
    assert body["scope"] == "TEAM"
    assert "Estado actual" in body["answer"]
    app.dependency_overrides.clear()


def test_ai_chat_history_manager_allowed(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    def _fake_history(self, actor_id: str, limit: int = 20):
        assert actor_id == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        assert limit == 5
        return [
            SimpleNamespace(
                id=1,
                question="estado",
                answer="Estado actual",
                scope="TEAM",
                created_at=datetime.now(timezone.utc),
            )
        ]

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(AIChatService, "history", _fake_history)

    response = client.get("/api/v1/ai/chat/history", params={"limit": 5})

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["scope"] == "TEAM"
    app.dependency_overrides.clear()
