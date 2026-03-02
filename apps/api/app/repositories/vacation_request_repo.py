from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

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

    def count_team_occupied_on_day(self, team_id: str, target_day: date) -> int:
        stmt = select(func.count(VacationRequest.id)).where(
            VacationRequest.team_id == team_id,
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date <= target_day,
            VacationRequest.end_date >= target_day,
        )
        return int(self.db.execute(stmt).scalar_one())

    def list_pending_by_manager(self, manager_id: str) -> list[VacationRequest]:
        stmt = (
            select(VacationRequest)
            .where(
                VacationRequest.manager_id == manager_id,
                VacationRequest.status == VacationRequestStatus.PENDING,
            )
            .order_by(VacationRequest.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

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
