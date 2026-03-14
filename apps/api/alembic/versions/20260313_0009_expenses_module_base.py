"""Add finance role and expenses module base tables.

Revision ID: 20260313_0009
Revises: 20260307_0008
Create Date: 2026-03-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260313_0009"
down_revision = "20260307_0008"
branch_labels = None
depends_on = None


expense_report_status = sa.Enum(
    "DRAFT",
    "PROCESSING",
    "SUBMITTED",
    "IN_REVIEW",
    "NEEDS_CORRECTION",
    "APPROVED",
    "REJECTED",
    name="expense_report_status",
)

expense_report_type = sa.Enum(
    "GENERAL",
    "TRAVEL",
    "MEAL",
    "TRANSPORT",
    "MIXED",
    name="expense_report_type",
)

expense_receipt_status = sa.Enum(
    "UPLOADED",
    "PROCESSING",
    "PROCESSED",
    "REVIEW_REQUIRED",
    "FAILED",
    name="expense_receipt_status",
)

expense_document_type = sa.Enum(
    "INVOICE",
    "RECEIPT",
    "TICKET",
    "CFDI_XML",
    "OTHER",
    name="expense_document_type",
)

expense_action_type = sa.Enum(
    "REPORT_CREATED",
    "RECEIPT_UPLOADED",
    "OCR_COMPLETED",
    "FIELDS_EDITED",
    "SUBMITTED",
    "APPROVED",
    "REJECTED",
    "CORRECTION_REQUESTED",
    "RESUBMITTED",
    name="expense_action_type",
)


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FINANCE'")

    bind = op.get_bind()
    expense_report_status.create(bind, checkfirst=True)
    expense_report_type.create(bind, checkfirst=True)
    expense_receipt_status.create(bind, checkfirst=True)
    expense_document_type.create(bind, checkfirst=True)
    expense_action_type.create(bind, checkfirst=True)

    op.create_table(
        "expense_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.create_table(
        "expense_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("vacation_request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("report_type", expense_report_type, nullable=False, server_default="GENERAL"),
        sa.Column("expense_date_from", sa.Date(), nullable=True),
        sa.Column("expense_date_to", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="MXN"),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("tax_total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", expense_report_status, nullable=False, server_default="DRAFT"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("finance_comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("subtotal >= 0", name="chk_expense_report_subtotal_non_negative"),
        sa.CheckConstraint("tax_total >= 0", name="chk_expense_report_tax_non_negative"),
        sa.CheckConstraint("total >= 0", name="chk_expense_report_total_non_negative"),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["vacation_request_id"], ["vacation_requests.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_expense_reports_manager_id", "expense_reports", ["manager_id"])
    op.create_index("ix_expense_reports_status", "expense_reports", ["status"])
    op.create_index("ix_expense_reports_employee_id", "expense_reports", ["employee_id"])

    op.create_table(
        "expense_receipts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expense_report_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checksum", sa.String(length=128), nullable=True),
        sa.Column("document_type", expense_document_type, nullable=False, server_default="INVOICE"),
        sa.Column("ocr_status", expense_receipt_status, nullable=False, server_default="UPLOADED"),
        sa.Column("ocr_provider", sa.String(length=50), nullable=True),
        sa.Column("ocr_raw_text", sa.Text(), nullable=True),
        sa.Column("extracted_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ai_confidence", sa.Numeric(4, 2), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("issuer_rfc", sa.String(length=20), nullable=True),
        sa.Column("issuer_name", sa.String(length=255), nullable=True),
        sa.Column("folio", sa.String(length=100), nullable=True),
        sa.Column("subtotal", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("iva", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="MXN"),
        sa.Column("suggested_category", sa.String(length=80), nullable=True),
        sa.Column("sat_usage", sa.String(length=20), nullable=True),
        sa.Column("payment_method", sa.String(length=50), nullable=True),
        sa.Column("payment_form", sa.String(length=50), nullable=True),
        sa.Column("fiscal_uuid", sa.String(length=100), nullable=True),
        sa.Column("is_validated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("file_size >= 0", name="chk_expense_receipt_file_size_non_negative"),
        sa.CheckConstraint("subtotal >= 0", name="chk_expense_receipt_subtotal_non_negative"),
        sa.CheckConstraint("iva >= 0", name="chk_expense_receipt_iva_non_negative"),
        sa.CheckConstraint("total >= 0", name="chk_expense_receipt_total_non_negative"),
        sa.ForeignKeyConstraint(["category_id"], ["expense_categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["expense_report_id"], ["expense_reports.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_expense_receipts_report_id", "expense_receipts", ["expense_report_id"])
    op.create_index("ix_expense_receipts_ocr_status", "expense_receipts", ["ocr_status"])

    op.create_table(
        "expense_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expense_report_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("expense_receipt_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_role", sa.String(length=20), nullable=False),
        sa.Column("action_type", expense_action_type, nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["expense_receipt_id"], ["expense_receipts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["expense_report_id"], ["expense_reports.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_expense_actions_report_id", "expense_actions", ["expense_report_id"])

    op.bulk_insert(
        sa.table(
            "expense_categories",
            sa.column("id", postgresql.UUID(as_uuid=True)),
            sa.column("code", sa.String),
            sa.column("name", sa.String),
            sa.column("description", sa.String),
            sa.column("is_active", sa.Boolean),
        ),
        [
            {"id": postgresql.UUID(as_uuid=True).python_type("11111111-1111-1111-1111-111111111111"), "code": "gasolina", "name": "Gasolina", "description": "Combustible y recargas relacionadas", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("22222222-2222-2222-2222-222222222222"), "code": "transporte", "name": "Transporte", "description": "Taxis, apps de movilidad, autobús y traslados", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("33333333-3333-3333-3333-333333333333"), "code": "comida", "name": "Comida", "description": "Alimentos y consumo durante viáticos", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("44444444-4444-4444-4444-444444444444"), "code": "hospedaje", "name": "Hospedaje", "description": "Hotel, alojamiento y estancias", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("55555555-5555-5555-5555-555555555555"), "code": "casetas", "name": "Casetas", "description": "Peajes y casetas", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("66666666-6666-6666-6666-666666666666"), "code": "estacionamiento", "name": "Estacionamiento", "description": "Parquímetros y estacionamientos", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("77777777-7777-7777-7777-777777777777"), "code": "vuelo", "name": "Vuelo", "description": "Boletos de avión y cargos asociados", "is_active": True},
            {"id": postgresql.UUID(as_uuid=True).python_type("88888888-8888-8888-8888-888888888888"), "code": "otros", "name": "Otros", "description": "Otros gastos operativos permitidos", "is_active": True},
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_expense_actions_report_id", table_name="expense_actions")
    op.drop_table("expense_actions")

    op.drop_index("ix_expense_receipts_ocr_status", table_name="expense_receipts")
    op.drop_index("ix_expense_receipts_report_id", table_name="expense_receipts")
    op.drop_table("expense_receipts")

    op.drop_index("ix_expense_reports_employee_id", table_name="expense_reports")
    op.drop_index("ix_expense_reports_status", table_name="expense_reports")
    op.drop_index("ix_expense_reports_manager_id", table_name="expense_reports")
    op.drop_table("expense_reports")

    op.drop_table("expense_categories")

    bind = op.get_bind()
    expense_action_type.drop(bind, checkfirst=True)
    expense_document_type.drop(bind, checkfirst=True)
    expense_receipt_status.drop(bind, checkfirst=True)
    expense_report_type.drop(bind, checkfirst=True)
    expense_report_status.drop(bind, checkfirst=True)
