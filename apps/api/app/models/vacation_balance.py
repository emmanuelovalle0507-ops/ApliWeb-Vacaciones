from datetime import datetime, timezone

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class VacationBalance(Base):
    __tablename__ = "vacation_balances"
    __table_args__ = (
        UniqueConstraint("user_id", "year", name="uq_balance_user_year"),
        CheckConstraint("available_days >= 0", name="chk_balance_available_non_negative"),
        CheckConstraint("used_days >= 0", name="chk_balance_used_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    available_days: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    used_days: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False, default=0)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
