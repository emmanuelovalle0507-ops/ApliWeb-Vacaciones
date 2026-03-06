"""
Mexican public holidays — used to exclude from business day calculations.
"""

from datetime import date
from functools import lru_cache


def _nth_weekday_of_month(year: int, month: int, weekday: int, n: int) -> date:
    """Return the nth occurrence of a weekday (0=Mon) in a given month."""
    first = date(year, month, 1)
    offset = (weekday - first.weekday()) % 7
    day = 1 + offset + (n - 1) * 7
    return date(year, month, day)


@lru_cache(maxsize=16)
def get_mexican_holidays(year: int) -> frozenset[date]:
    """Return the set of official Mexican public holidays for the given year."""
    return frozenset(
        {
            date(year, 1, 1),  # Año Nuevo
            _nth_weekday_of_month(year, 2, 0, 1),  # Día de la Constitución (1er lunes feb)
            _nth_weekday_of_month(year, 3, 0, 3),  # Natalicio de Benito Juárez (3er lunes mar)
            date(year, 5, 1),  # Día del Trabajo
            date(year, 9, 16),  # Día de la Independencia
            _nth_weekday_of_month(year, 11, 0, 3),  # Revolución Mexicana (3er lunes nov)
            date(year, 12, 25),  # Navidad
        }
    )


def is_holiday(d: date) -> bool:
    """Check if a date is a Mexican public holiday."""
    return d in get_mexican_holidays(d.year)
