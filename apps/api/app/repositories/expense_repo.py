from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.expense import ExpenseAction, ExpenseCategory, ExpenseReceipt, ExpenseReport, ExpenseReportStatus


class ExpenseRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add_report(self, report: ExpenseReport) -> ExpenseReport:
        self.db.add(report)
        self.db.flush()
        self.db.refresh(report)
        return report

    def get_report(self, report_id: str) -> ExpenseReport | None:
        stmt = select(ExpenseReport).where(ExpenseReport.id == report_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_reports_by_manager(self, manager_id: str) -> list[ExpenseReport]:
        stmt = (
            select(ExpenseReport)
            .where(ExpenseReport.manager_id == manager_id)
            .order_by(ExpenseReport.created_at.desc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def list_reports_for_finance(self, status: str | None = None) -> list[ExpenseReport]:
        stmt = select(ExpenseReport)
        if status:
            stmt = stmt.where(ExpenseReport.status == status)
        stmt = stmt.order_by(ExpenseReport.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def list_reports_for_admin(self, status: str | None = None) -> list[ExpenseReport]:
        return self.list_reports_for_finance(status=status)

    def list_categories(self) -> list[ExpenseCategory]:
        stmt = select(ExpenseCategory).where(ExpenseCategory.is_active.is_(True)).order_by(ExpenseCategory.name.asc())
        return list(self.db.execute(stmt).scalars().all())

    def list_actions(self, report_id: str) -> list[ExpenseAction]:
        stmt = select(ExpenseAction).where(ExpenseAction.expense_report_id == report_id).order_by(ExpenseAction.created_at.asc())
        return list(self.db.execute(stmt).scalars().all())

    def list_receipts(self, report_id: str) -> list[ExpenseReceipt]:
        stmt = select(ExpenseReceipt).where(ExpenseReceipt.expense_report_id == report_id).order_by(ExpenseReceipt.created_at.asc())
        return list(self.db.execute(stmt).scalars().all())

    def get_receipt(self, receipt_id: str) -> ExpenseReceipt | None:
        stmt = select(ExpenseReceipt).where(ExpenseReceipt.id == receipt_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def add_receipt(self, receipt: ExpenseReceipt) -> ExpenseReceipt:
        self.db.add(receipt)
        self.db.flush()
        self.db.refresh(receipt)
        return receipt

    def add_action(self, action: ExpenseAction) -> ExpenseAction:
        self.db.add(action)
        self.db.flush()
        self.db.refresh(action)
        return action

    def get_summary_counts(self) -> dict[str, int]:
        base: Select = select(ExpenseReport.status, func.count()).group_by(ExpenseReport.status)
        rows = self.db.execute(base).all()
        summary = {status.value if hasattr(status, 'value') else str(status): count for status, count in rows}
        for status in ExpenseReportStatus:
            summary.setdefault(status.value, 0)
        return summary
