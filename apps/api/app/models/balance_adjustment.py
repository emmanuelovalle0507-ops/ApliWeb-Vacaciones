from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class BalanceAdjustmentType(str, Enum):
    DEBIT_APPROVAL = "DEBIT_APPROVAL"
    CREDIT_CANCEL = "CREDIT_CANCEL"
    ADMIN_MANUAL_ADJUST = "ADMIN_MANUAL_ADJUST"


class BalanceAdjustment(Base):
    __tablename__ = "balance_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    request_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vacation_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    adjustment_type: Mapped[BalanceAdjustmentType] = mapped_column(
        SQLEnum(BalanceAdjustmentType, name="balance_adjustment_type"),
        nullable=False,
    )
    days_delta: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    performed_by: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    operation_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
