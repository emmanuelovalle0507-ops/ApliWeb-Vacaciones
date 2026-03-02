"""Pruebas de integración enfocadas en autenticación y autorización por rol.

Objetivo:
- Verificar barreras de seguridad del API sin depender de frontend.
- Confirmar que endpoints protegidos rechazan usuarios sin token.
- Confirmar que RBAC bloquea roles incorrectos.

Nota:
- Se usa monkeypatch para evitar acceso real a base de datos en pruebas de roles.
- Esto permite validar el contrato de seguridad de forma rápida y estable.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.main import app
from app.schemas.auth import UserSummary
from app.services.vacation_request_service import PolicyValidationError, VacationRequestService


client = TestClient(app)


@dataclass
class _Status:
    value: str


def _fake_request_item() -> SimpleNamespace:
    return SimpleNamespace(
        id="11111111-1111-1111-1111-111111111111",
        team_id="99999999-9999-9999-9999-999999999999",
        employee_id="22222222-2222-2222-2222-222222222222",
        manager_id="33333333-3333-3333-3333-333333333333",
        start_date=datetime(2026, 3, 10, tzinfo=timezone.utc).date(),
        end_date=datetime(2026, 3, 14, tzinfo=timezone.utc).date(),
        requested_days=5,
        status=_Status("PENDING"),
        reason="Vacaciones",
        decision_comment=None,
        approved_at=None,
        rejected_at=None,
        cancelled_at=None,
        created_at=datetime.now(timezone.utc),
    )


def test_protected_endpoint_requires_token() -> None:
    response = client.get("/api/v1/vacation-requests/me")
    assert response.status_code == 401


def test_manager_endpoint_forbidden_for_employee(monkeypatch) -> None:
    def _employee_user() -> UserSummary:
        return UserSummary(
            id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            full_name="Empleado Test",
            role="EMPLOYEE",
        )

    app.dependency_overrides[get_current_user] = _employee_user

    response = client.get("/api/v1/manager/vacation-requests/pending")

    assert response.status_code == 403
    app.dependency_overrides.clear()


def test_manager_reject_endpoint_returns_422_for_policy_validation(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
            team_id="99999999-9999-9999-9999-999999999999",
        )

    def _fake_reject(self, request_id: str, manager_id: str, decision_comment: str | None):
        raise PolicyValidationError("Decision comment is required when rejecting a request")

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(VacationRequestService, "reject", _fake_reject)

    response = client.post(
        "/api/v1/manager/vacation-requests/11111111-1111-1111-1111-111111111111/reject",
        json={"decision_comment": ""},
    )

    assert response.status_code == 422
    app.dependency_overrides.clear()


def test_manager_endpoint_allows_manager(monkeypatch) -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
        )

    def _fake_list_pending(self, manager_id: str):
        assert manager_id == "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        return [_fake_request_item()]

    app.dependency_overrides[get_current_user] = _manager_user
    monkeypatch.setattr(VacationRequestService, "list_pending_for_manager", _fake_list_pending)

    response = client.get("/api/v1/manager/vacation-requests/pending")

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["status"] == "PENDING"

    app.dependency_overrides.clear()


def test_admin_adjust_endpoint_forbidden_for_manager() -> None:
    def _manager_user() -> UserSummary:
        return UserSummary(
            id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            full_name="Manager Test",
            role="MANAGER",
        )

    app.dependency_overrides[get_current_user] = _manager_user

    response = client.post(
        "/api/v1/admin/vacation-balances/22222222-2222-2222-2222-222222222222/adjust",
        params={"year": 2026},
        json={"days_delta": 2, "reason": "test"},
    )

    assert response.status_code == 403
    app.dependency_overrides.clear()
