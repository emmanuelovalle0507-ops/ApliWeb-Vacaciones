from datetime import date

from sqlalchemy import func, or_, select, Select
from sqlalchemy.orm import Session

from app.models.user_manager import UserManager
from app.models.vacation_request import VacationRequest, VacationRequestStatus


class VacationRequestRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, request: VacationRequest) -> VacationRequest:
        self.db.add(request)
        self.db.flush()
        self.db.refresh(request)
        return request

    def get_by_id(self, request_id: str) -> VacationRequest | None:
        stmt = select(VacationRequest).where(VacationRequest.id == request_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id_for_update(self, request_id: str) -> VacationRequest | None:
        stmt = select(VacationRequest).where(VacationRequest.id == request_id).with_for_update()
        return self.db.execute(stmt).scalar_one_or_none()

    def list_by_employee(self, employee_id: str) -> list[VacationRequest]:
        stmt = (
            select(VacationRequest)
            .where(VacationRequest.employee_id == employee_id)
            .order_by(VacationRequest.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_by_employee_paginated(self, employee_id: str, *, offset: int = 0, limit: int = 20) -> tuple[list[VacationRequest], int]:
        base = select(VacationRequest).where(VacationRequest.employee_id == employee_id)
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(VacationRequest.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def count_team_occupied_on_day(self, team_id: str, target_day: date) -> int:
        stmt = select(func.count(VacationRequest.id)).where(
            VacationRequest.team_id == team_id,
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= target_day,
            VacationRequest.end_date >= target_day,
        )
        return int(self.db.execute(stmt).scalar_one())

    def _employee_ids_for_manager(self, manager_id: str) -> Select:
        return select(UserManager.user_id).where(UserManager.manager_id == manager_id)

    def list_pending_by_manager(self, manager_id: str) -> list[VacationRequest]:
        employee_ids = self._employee_ids_for_manager(manager_id)
        stmt = (
            select(VacationRequest)
            .where(
                or_(
                    VacationRequest.manager_id == manager_id,
                    VacationRequest.employee_id.in_(employee_ids),
                ),
                VacationRequest.status == VacationRequestStatus.PENDING,
            )
            .order_by(VacationRequest.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_pending_by_manager_paginated(self, manager_id: str, *, offset: int = 0, limit: int = 20) -> tuple[list[VacationRequest], int]:
        employee_ids = self._employee_ids_for_manager(manager_id)
        base = select(VacationRequest).where(
            or_(
                VacationRequest.manager_id == manager_id,
                VacationRequest.employee_id.in_(employee_ids),
            ),
            VacationRequest.status == VacationRequestStatus.PENDING,
        )
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(VacationRequest.created_at.asc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def list_all(
        self,
        status: str | None = None,
        team_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[VacationRequest]:
        stmt = select(VacationRequest).order_by(VacationRequest.created_at.desc())
        if status:
            stmt = stmt.where(VacationRequest.status == status)
        if team_id:
            stmt = stmt.where(VacationRequest.team_id == team_id)
        if start_date:
            stmt = stmt.where(VacationRequest.start_date >= start_date)
        if end_date:
            stmt = stmt.where(VacationRequest.end_date <= end_date)
        return list(self.db.execute(stmt).scalars().all())

    def list_all_paginated(
        self,
        *,
        status: str | None = None,
        team_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[VacationRequest], int]:
        base = select(VacationRequest)
        if status:
            base = base.where(VacationRequest.status == status)
        if team_id:
            base = base.where(VacationRequest.team_id == team_id)
        if start_date:
            base = base.where(VacationRequest.start_date >= start_date)
        if end_date:
            base = base.where(VacationRequest.end_date <= end_date)
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(VacationRequest.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        return self.db.execute(count_stmt).scalar_one()
