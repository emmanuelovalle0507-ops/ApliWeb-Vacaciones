from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.models.expense_receipt import ExpenseReceipt, ExtractionStatus


class ExpenseReceiptRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, receipt: ExpenseReceipt) -> ExpenseReceipt:
        self.db.add(receipt)
        self.db.flush()
        self.db.refresh(receipt)
        return receipt

    def get_by_id(self, receipt_id: str) -> ExpenseReceipt | None:
        return self.db.execute(
            select(ExpenseReceipt).where(ExpenseReceipt.id == receipt_id)
        ).scalar_one_or_none()

    def list_by_owner(
        self,
        owner_id: str,
        *,
        report_id: str | None = None,
        unassigned_only: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[ExpenseReceipt], int]:
        base = select(ExpenseReceipt).where(ExpenseReceipt.owner_id == owner_id)
        if report_id:
            base = base.where(ExpenseReceipt.report_id == report_id)
        if unassigned_only:
            base = base.where(ExpenseReceipt.report_id.is_(None))
        total = self.db.execute(select(func.count()).select_from(base.subquery())).scalar_one()
        items = list(
            self.db.execute(
                base.order_by(ExpenseReceipt.created_at.desc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def update_extraction(
        self,
        receipt_id: str,
        *,
        status: ExtractionStatus,
        ocr_text: str | None = None,
        extraction_json: dict | None = None,
        confidence: float | None = None,
        vendor_name: str | None = None,
        receipt_date=None,
        total_amount: float | None = None,
        currency: str | None = None,
        tax_amount: float | None = None,
        payment_method: str | None = None,
        category: str | None = None,
        description: str | None = None,
    ) -> ExpenseReceipt | None:
        receipt = self.get_by_id(receipt_id)
        if not receipt:
            return None
        receipt.extraction_status = status
        if ocr_text is not None:
            receipt.ocr_text = ocr_text
        if extraction_json is not None:
            receipt.extraction_json = extraction_json
        if confidence is not None:
            receipt.extraction_confidence = confidence
        if vendor_name is not None:
            receipt.vendor_name = vendor_name
        if receipt_date is not None:
            receipt.receipt_date = receipt_date
        if total_amount is not None:
            receipt.total_amount = total_amount
        if currency is not None:
            receipt.currency = currency
        if tax_amount is not None:
            receipt.tax_amount = tax_amount
        if payment_method is not None:
            receipt.payment_method = payment_method
        if category is not None:
            from app.models.expense_receipt import ExpenseCategory
            try:
                receipt.category = ExpenseCategory(category)
            except (ValueError, KeyError):
                pass  # skip invalid category values
        if description is not None:
            receipt.description = description
        self.db.flush()
        return receipt
