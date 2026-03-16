"""Add FINANCE role + expense_reports, expense_receipts, expense_actions tables.

Revision ID: 20260310_0009
Revises: 20260307_0008
Create Date: 2026-03-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "20260310_0009"
down_revision = "20260307_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add FINANCE to user_role enum
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FINANCE'")

    # 2) expense_reports
    op.create_table(
        "expense_reports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("period_start", sa.Date, nullable=False),
        sa.Column("period_end", sa.Date, nullable=False),
        sa.Column("status", sa.Enum("DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "NEEDS_CHANGES", name="expense_report_status"), nullable=False, server_default="DRAFT"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MXN"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decision_comment", sa.Text, nullable=True),
        sa.Column("decided_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 4) expense_receipts
    op.create_table(
        "expense_receipts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("report_id", UUID(as_uuid=True), sa.ForeignKey("expense_reports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        # File info
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_content_type", sa.String(100), nullable=False),
        sa.Column("file_size_bytes", sa.Integer, nullable=False),
        # OCR / extraction
        sa.Column("ocr_text", sa.Text, nullable=True),
        sa.Column("extraction_json", JSONB, nullable=True),
        sa.Column("extraction_status", sa.Enum("PENDING", "PROCESSING", "DONE", "FAILED", name="extraction_status"), nullable=False, server_default="PENDING"),
        sa.Column("extraction_confidence", sa.Numeric(3, 2), nullable=True),
        # Normalized fields
        sa.Column("vendor_name", sa.String(200), nullable=True),
        sa.Column("receipt_date", sa.Date, nullable=True),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(3), nullable=True, server_default="MXN"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("payment_method", sa.String(20), nullable=True),
        sa.Column("category", sa.Enum("GASOLINE", "TOLLS", "FOOD", "HOTEL", "TRANSPORT", "PARKING", "SUPPLIES", "OTHER", name="expense_category"), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # 4) expense_actions (audit for expenses)
    op.create_table(
        "expense_actions",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("actor_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("report_id", UUID(as_uuid=True), sa.ForeignKey("expense_reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Indexes
    op.create_index("ix_expense_reports_owner_id", "expense_reports", ["owner_id"])
    op.create_index("ix_expense_reports_status", "expense_reports", ["status"])
    op.create_index("ix_expense_receipts_owner_id", "expense_receipts", ["owner_id"])
    op.create_index("ix_expense_receipts_report_id", "expense_receipts", ["report_id"])
    op.create_index("ix_expense_actions_report_id", "expense_actions", ["report_id"])


def downgrade() -> None:
    op.drop_table("expense_actions")
    op.drop_table("expense_receipts")
    op.drop_table("expense_reports")
    op.execute("DROP TYPE IF EXISTS expense_category")
    op.execute("DROP TYPE IF EXISTS extraction_status")
    op.execute("DROP TYPE IF EXISTS expense_report_status")
    # NOTE: Cannot remove 'FINANCE' from user_role enum in PostgreSQL
