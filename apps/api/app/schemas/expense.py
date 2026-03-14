from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ExpenseCategoryOut(BaseModel):
    id: str
    code: str
    name: str
    description: str | None = None
    is_active: bool


class ExpenseReceiptOut(BaseModel):
    id: str
    expense_report_id: str
    uploaded_by: str
    category_id: str | None = None
    original_filename: str
    stored_filename: str
    storage_path: str
    mime_type: str
    file_size: int
    checksum: str | None = None
    document_type: str
    ocr_status: str
    ocr_provider: str | None = None
    ai_confidence: Decimal | None = None
    invoice_date: date | None = None
    issuer_rfc: str | None = None
    issuer_name: str | None = None
    folio: str | None = None
    subtotal: Decimal
    iva: Decimal
    total: Decimal
    currency: str
    suggested_category: str | None = None
    sat_usage: str | None = None
    payment_method: str | None = None
    payment_form: str | None = None
    fiscal_uuid: str | None = None
    is_validated: bool
    extracted_data: dict | None = None
    created_at: datetime
    updated_at: datetime


class ExpenseActionOut(BaseModel):
    id: str
    expense_report_id: str
    expense_receipt_id: str | None = None
    actor_id: str
    actor_role: str
    action_type: str
    comment: str | None = None
    metadata: dict | None = None
    created_at: datetime


class ExpenseReportOut(BaseModel):
    id: str
    manager_id: str
    employee_id: str | None = None
    team_id: str | None = None
    vacation_request_id: str | None = None
    title: str
    description: str | None = None
    report_type: str
    expense_date_from: date | None = None
    expense_date_to: date | None = None
    currency: str
    subtotal: Decimal
    tax_total: Decimal
    total: Decimal
    status: str
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    finance_comment: str | None = None
    created_at: datetime
    updated_at: datetime
    receipts: list[ExpenseReceiptOut] = Field(default_factory=list)
    actions: list[ExpenseActionOut] = Field(default_factory=list)


class ExpenseReportCreateIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=160)
    description: str | None = None
    report_type: str = Field(default="GENERAL", pattern=r"^(GENERAL|TRAVEL|MEAL|TRANSPORT|MIXED)$")
    employee_id: str | None = None
    team_id: str | None = None
    vacation_request_id: str | None = None
    expense_date_from: date | None = None
    expense_date_to: date | None = None
    currency: str = Field(default="MXN", min_length=3, max_length=10)


class ExpenseReportUpdateIn(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=160)
    description: str | None = None
    report_type: str | None = Field(None, pattern=r"^(GENERAL|TRAVEL|MEAL|TRANSPORT|MIXED)$")
    employee_id: str | None = None
    team_id: str | None = None
    vacation_request_id: str | None = None
    expense_date_from: date | None = None
    expense_date_to: date | None = None
    currency: str | None = Field(None, min_length=3, max_length=10)


class ExpenseReceiptUpdateIn(BaseModel):
    category_id: str | None = None
    invoice_date: date | None = None
    issuer_rfc: str | None = Field(None, max_length=20)
    issuer_name: str | None = Field(None, max_length=255)
    folio: str | None = Field(None, max_length=100)
    subtotal: Decimal | None = None
    iva: Decimal | None = None
    total: Decimal | None = None
    currency: str | None = Field(None, min_length=3, max_length=10)
    suggested_category: str | None = Field(None, max_length=80)
    sat_usage: str | None = Field(None, max_length=20)
    payment_method: str | None = Field(None, max_length=50)
    payment_form: str | None = Field(None, max_length=50)
    fiscal_uuid: str | None = Field(None, max_length=100)
    is_validated: bool | None = None


class ExpenseReportDecisionIn(BaseModel):
    comment: str | None = None


class ExpenseReportListOut(BaseModel):
    items: list[ExpenseReportOut] = Field(default_factory=list)
