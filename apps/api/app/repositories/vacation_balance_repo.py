from sqlalchemy import func, select, Select
from sqlalchemy.orm import Session

from app.models.vacation_balance import VacationBalance


class VacationBalanceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_user_year(self, user_id: str, year: int) -> VacationBalance | None:
        stmt = select(VacationBalance).where(VacationBalance.user_id == user_id, VacationBalance.year == year)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_user_year_for_update(self, user_id: str, year: int) -> VacationBalance | None:
        stmt = (
            select(VacationBalance)
            .where(VacationBalance.user_id == user_id, VacationBalance.year == year)
            .with_for_update()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def add(self, balance: VacationBalance) -> VacationBalance:
        self.db.add(balance)
        self.db.flush()
        self.db.refresh(balance)
        return balance

    def list_by_year(self, year: int) -> list[VacationBalance]:
        stmt = (
            select(VacationBalance)
            .where(VacationBalance.year == year)
            .order_by(VacationBalance.user_id)
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_by_year_paginated(self, year: int, *, offset: int = 0, limit: int = 20) -> tuple[list[VacationBalance], int]:
        base = select(VacationBalance).where(VacationBalance.year == year)
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(VacationBalance.user_id).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        return self.db.execute(count_stmt).scalar_one()
