from datetime import date

from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.models.expense_report import ExpenseReport, ExpenseReportStatus


class ExpenseReportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, report: ExpenseReport) -> ExpenseReport:
        self.db.add(report)
        self.db.flush()
        self.db.refresh(report)
        return report

    def get_by_id(self, report_id: str) -> ExpenseReport | None:
        return self.db.execute(
            select(ExpenseReport).where(ExpenseReport.id == report_id)
        ).scalar_one_or_none()

    def list_by_owner(
        self,
        owner_id: str,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ExpenseReport], int]:
        base = select(ExpenseReport).where(ExpenseReport.owner_id == owner_id)
        if status:
            base = base.where(ExpenseReport.status == status)
        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        items = list(
            self.db.execute(
                base.order_by(ExpenseReport.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def list_all(
        self,
        *,
        status: str | None = None,
        owner_id: str | None = None,
        team_id: str | None = None,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ExpenseReport], int]:
        base = select(ExpenseReport)
        if status:
            base = base.where(ExpenseReport.status == status)
        if owner_id:
            base = base.where(ExpenseReport.owner_id == owner_id)
        if team_id:
            base = base.where(ExpenseReport.team_id == team_id)
        if search:
            pattern = f"%{search}%"
            base = base.where(
                or_(
                    ExpenseReport.title.ilike(pattern),
                    ExpenseReport.decision_comment.ilike(pattern),
                )
            )
        if date_from:
            base = base.where(ExpenseReport.period_start >= date_from)
        if date_to:
            base = base.where(ExpenseReport.period_end <= date_to)
        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        items = list(
            self.db.execute(
                base.order_by(ExpenseReport.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total
