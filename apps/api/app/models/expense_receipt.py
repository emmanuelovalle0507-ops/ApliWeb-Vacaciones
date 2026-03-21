import uuid
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import Date, DateTime, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class ExtractionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    DONE = "DONE"
    FAILED = "FAILED"


class ReceiptDecision(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ExpenseCategory(str, Enum):
    GASOLINE = "GASOLINE"
    TOLLS = "TOLLS"
    FOOD = "FOOD"
    HOTEL = "HOTEL"
    TRANSPORT = "TRANSPORT"
    PARKING = "PARKING"
    SUPPLIES = "SUPPLIES"
    OTHER = "OTHER"


class ExpenseReceipt(Base):
    __tablename__ = "expense_receipts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("expense_reports.id", ondelete="SET NULL"), nullable=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # File info
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # OCR / extraction
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    extraction_status: Mapped[ExtractionStatus] = mapped_column(
        SQLEnum(ExtractionStatus, name="extraction_status"),
        nullable=False,
        default=ExtractionStatus.PENDING,
    )
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)

    # Normalized fields (extracted by AI)
    vendor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    receipt_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True, default="MXN")
    tax_amount: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    category: Mapped[ExpenseCategory | None] = mapped_column(
        SQLEnum(ExpenseCategory, name="expense_category"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Finance per-ticket decision
    decision: Mapped[ReceiptDecision] = mapped_column(
        SQLEnum(ReceiptDecision, name="receipt_decision"),
        nullable=False,
        default=ReceiptDecision.PENDING,
        server_default="PENDING",
    )
    decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    report: Mapped["ExpenseReport | None"] = relationship(
        "ExpenseReport", back_populates="receipts"
    )


if False:  # TYPE_CHECKING
    from app.models.expense_report import ExpenseReport  # noqa: F401
