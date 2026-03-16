from __future__ import annotations

from contextlib import contextmanager
from datetime import date
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.models.vacation_request import VacationRequestStatus
from app.services.vacation_request_service import PolicyValidationError, VacationRequestService


@contextmanager
def _tx_ok():
    yield


def _service_without_init() -> VacationRequestService:
    return object.__new__(VacationRequestService)


def test_create_request_requires_reason_when_below_min_notice() -> None:
    service = _service_without_init()
    service.db = SimpleNamespace(begin=_tx_ok)

    employee = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        manager_id=UUID("22222222-2222-2222-2222-222222222222"),
        team_id=UUID("33333333-3333-3333-3333-333333333333"),
    )
    manager = SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        team_id=UUID("33333333-3333-3333-3333-333333333333"),
    )

    class _UserRepo:
        @staticmethod
        def get_by_id(user_id: str):
            if user_id == str(employee.id):
                return employee
            if user_id == str(manager.id):
                return manager
            return None

        @staticmethod
        def get_manager_ids(user_id: str):
            return [str(manager.id)]

    service.user_repo = _UserRepo()
    service.request_repo = SimpleNamespace(
        count_team_occupied_on_day=lambda team_id, day: 0,
        list_by_employee=lambda employee_id: [],
    )
    service.balance_repo = SimpleNamespace(
        get_by_user_year=lambda uid, yr: SimpleNamespace(available_days=20),
    )
    service.policy_repo = SimpleNamespace(
        get_active_for_date=lambda team_id, target_date: SimpleNamespace(
            max_people_off_per_day=2,
            min_notice_days=10,
        )
    )
    service.audit_repo = SimpleNamespace(add=lambda entry: None)

    service._today = staticmethod(lambda: date(2026, 3, 1))  # type: ignore[method-assign]

    with pytest.raises(PolicyValidationError, match="requiere mínimo"):
        service.create_request(
            employee_id=str(employee.id),
            start_date=date(2026, 3, 5),
            end_date=date(2026, 3, 6),
            reason=None,
        )


def test_reject_requires_decision_comment() -> None:
    service = _service_without_init()
    service.db = SimpleNamespace(begin=_tx_ok)

    request = SimpleNamespace(
        id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        manager_id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        status=VacationRequestStatus.PENDING,
        team_id=None,
    )

    class _RequestRepo:
        @staticmethod
        def get_by_id_for_update(request_id: str):
            return request

    service.request_repo = _RequestRepo()

    with pytest.raises(PolicyValidationError, match="Debes escribir un comentario"):
        service.reject(
            request_id=str(request.id),
            manager_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            decision_comment="   ",
        )


def test_validate_team_daily_capacity_blocks_when_full() -> None:
    service = _service_without_init()
    service.policy_repo = SimpleNamespace(
        get_active_for_date=lambda team_id, target_date: SimpleNamespace(max_people_off_per_day=1)
    )
    service.request_repo = SimpleNamespace(count_team_occupied_on_day=lambda team_id, target_day: 1)

    with pytest.raises(PolicyValidationError, match="persona.*fuera"):
        service._validate_team_daily_capacity(
            team_id="33333333-3333-3333-3333-333333333333",
            start_date=date(2026, 4, 10),
            end_date=date(2026, 4, 10),
        )
