from datetime import date
from decimal import Decimal

import pytest

from app.services.vacation_request_service import VacationRequestService


@pytest.mark.parametrize(
    ("start_date", "end_date", "expected_days"),
    [
        (date(2026, 3, 10), date(2026, 3, 10), Decimal("1")),
        (date(2026, 3, 10), date(2026, 3, 14), Decimal("5")),
    ],
)
def test_calculate_requested_days(start_date: date, end_date: date, expected_days: Decimal) -> None:
    result = VacationRequestService._calculate_requested_days(start_date, end_date)
    assert result == expected_days


def test_calculate_requested_days_invalid_range() -> None:
    with pytest.raises(ValueError, match="Invalid date range"):
        VacationRequestService._calculate_requested_days(date(2026, 3, 14), date(2026, 3, 10))
