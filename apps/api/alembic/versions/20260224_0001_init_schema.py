"""init schema

Revision ID: 20260224_0001
Revises: 
Create Date: 2026-02-24 15:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260224_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN')")
    op.execute("CREATE TYPE vacation_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')")
    op.execute("CREATE TYPE balance_adjustment_type AS ENUM ('DEBIT_APPROVAL', 'CREDIT_CANCEL', 'ADMIN_MANUAL_ADJUST')")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.Enum("EMPLOYEE", "MANAGER", "ADMIN", name="user_role", create_constraint=False, native_enum=False), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], onupdate="CASCADE", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("idx_users_role", "users", ["role"])
    op.create_index("idx_users_manager_id", "users", ["manager_id"])

    op.create_table(
        "vacation_balances",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("available_days", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("used_days", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("available_days >= 0", name="chk_balance_available_non_negative"),
        sa.CheckConstraint("used_days >= 0", name="chk_balance_used_non_negative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "year", name="uq_balance_user_year"),
    )
    op.create_index("idx_balances_user_id", "vacation_balances", ["user_id"])
    op.create_index("idx_balances_year", "vacation_balances", ["year"])

    op.create_table(
        "vacation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("requested_days", sa.Numeric(6, 2), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "APPROVED", "REJECTED", "CANCELLED", name="vacation_request_status", create_constraint=False, native_enum=False), nullable=False, server_default="PENDING"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("decision_comment", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("end_date >= start_date", name="chk_request_date_range"),
        sa.CheckConstraint("requested_days > 0", name="chk_request_days_positive"),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_requests_employee_id", "vacation_requests", ["employee_id"])
    op.create_index("idx_requests_manager_id", "vacation_requests", ["manager_id"])
    op.create_index("idx_requests_status", "vacation_requests", ["status"])
    op.create_index("idx_requests_created_at", "vacation_requests", ["created_at"])
    op.create_index("idx_requests_manager_status", "vacation_requests", ["manager_id", "status"])

    op.create_table(
        "balance_adjustments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("request_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("adjustment_type", sa.Enum("DEBIT_APPROVAL", "CREDIT_CANCEL", "ADMIN_MANUAL_ADJUST", name="balance_adjustment_type", create_constraint=False, native_enum=False), nullable=False),
        sa.Column("days_delta", sa.Numeric(6, 2), nullable=False),
        sa.Column("performed_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("operation_key", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["performed_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["request_id"], ["vacation_requests.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("operation_key", name="uq_adjustment_operation_key"),
    )
    op.create_index("idx_adjustments_user_id", "balance_adjustments", ["user_id"])
    op.create_index("idx_adjustments_request_id", "balance_adjustments", ["request_id"])
    op.create_index("idx_adjustments_created_at", "balance_adjustments", ["created_at"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("idx_audit_action", "audit_logs", ["action"])
    op.create_index("idx_audit_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("idx_audit_metadata_gin", "audit_logs", ["metadata"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("idx_audit_metadata_gin", table_name="audit_logs")
    op.drop_index("idx_audit_entity", table_name="audit_logs")
    op.drop_index("idx_audit_action", table_name="audit_logs")
    op.drop_index("idx_audit_actor_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("idx_adjustments_created_at", table_name="balance_adjustments")
    op.drop_index("idx_adjustments_request_id", table_name="balance_adjustments")
    op.drop_index("idx_adjustments_user_id", table_name="balance_adjustments")
    op.drop_table("balance_adjustments")

    op.drop_index("idx_requests_manager_status", table_name="vacation_requests")
    op.drop_index("idx_requests_created_at", table_name="vacation_requests")
    op.drop_index("idx_requests_status", table_name="vacation_requests")
    op.drop_index("idx_requests_manager_id", table_name="vacation_requests")
    op.drop_index("idx_requests_employee_id", table_name="vacation_requests")
    op.drop_table("vacation_requests")

    op.drop_index("idx_balances_year", table_name="vacation_balances")
    op.drop_index("idx_balances_user_id", table_name="vacation_balances")
    op.drop_table("vacation_balances")

    op.drop_index("idx_users_manager_id", table_name="users")
    op.drop_index("idx_users_role", table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS balance_adjustment_type")
    op.execute("DROP TYPE IF EXISTS vacation_request_status")
    op.execute("DROP TYPE IF EXISTS user_role")
