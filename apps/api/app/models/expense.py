import uuid
from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class ExpenseReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    NEEDS_CORRECTION = "NEEDS_CORRECTION"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ExpenseReportType(str, Enum):
    GENERAL = "GENERAL"
    TRAVEL = "TRAVEL"
    MEAL = "MEAL"
    TRANSPORT = "TRANSPORT"
    MIXED = "MIXED"


class ExpenseReceiptStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    FAILED = "FAILED"


class ExpenseDocumentType(str, Enum):
    INVOICE = "INVOICE"
    RECEIPT = "RECEIPT"
    TICKET = "TICKET"
    CFDI_XML = "CFDI_XML"
    OTHER = "OTHER"


class ExpenseActionType(str, Enum):
    REPORT_CREATED = "REPORT_CREATED"
    RECEIPT_UPLOADED = "RECEIPT_UPLOADED"
    OCR_COMPLETED = "OCR_COMPLETED"
    FIELDS_EDITED = "FIELDS_EDITED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CORRECTION_REQUESTED = "CORRECTION_REQUESTED"
    RESUBMITTED = "RESUBMITTED"


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ExpenseReport(Base):
    __tablename__ = "expense_reports"
    __table_args__ = (
        CheckConstraint("total >= 0", name="chk_expense_report_total_non_negative"),
        CheckConstraint("tax_total >= 0", name="chk_expense_report_tax_non_negative"),
        CheckConstraint("subtotal >= 0", name="chk_expense_report_subtotal_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    manager_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True)
    vacation_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("vacation_requests.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_type: Mapped[ExpenseReportType] = mapped_column(SQLEnum(ExpenseReportType, name="expense_report_type"), nullable=False, default=ExpenseReportType.GENERAL)
    expense_date_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    expense_date_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="MXN")
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    tax_total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[ExpenseReportStatus] = mapped_column(SQLEnum(ExpenseReportStatus, name="expense_report_status"), nullable=False, default=ExpenseReportStatus.DRAFT)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    finance_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ExpenseReceipt(Base):
    __tablename__ = "expense_receipts"
    __table_args__ = (
        CheckConstraint("file_size >= 0", name="chk_expense_receipt_file_size_non_negative"),
        CheckConstraint("total >= 0", name="chk_expense_receipt_total_non_negative"),
        CheckConstraint("iva >= 0", name="chk_expense_receipt_iva_non_negative"),
        CheckConstraint("subtotal >= 0", name="chk_expense_receipt_subtotal_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checksum: Mapped[str | None] = mapped_column(String(128), nullable=True)
    document_type: Mapped[ExpenseDocumentType] = mapped_column(SQLEnum(ExpenseDocumentType, name="expense_document_type"), nullable=False, default=ExpenseDocumentType.INVOICE)
    ocr_status: Mapped[ExpenseReceiptStatus] = mapped_column(SQLEnum(ExpenseReceiptStatus, name="expense_receipt_status"), nullable=False, default=ExpenseReceiptStatus.UPLOADED)
    ocr_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    issuer_rfc: Mapped[str | None] = mapped_column(String(20), nullable=True)
    issuer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    folio: Mapped[str | None] = mapped_column(String(100), nullable=True)
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    iva: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    total: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="MXN")
    suggested_category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sat_usage: Mapped[str | None] = mapped_column(String(20), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_form: Mapped[str | None] = mapped_column(String(50), nullable=True)
    fiscal_uuid: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_validated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ExpenseAction(Base):
    __tablename__ = "expense_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    expense_report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False)
    expense_receipt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("expense_receipts.id", ondelete="SET NULL"), nullable=True)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(20), nullable=False)
    action_type: Mapped[ExpenseActionType] = mapped_column(SQLEnum(ExpenseActionType, name="expense_action_type"), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
