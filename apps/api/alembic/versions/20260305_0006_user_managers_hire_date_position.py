"""Add user_managers table, hire_date and position to users.

Revision ID: 20260305_0006
Revises: 20260304_0005
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20260305_0006"
down_revision = "20260304_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New association table for multi-manager support
    op.create_table(
        "user_managers",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("manager_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_user_managers_user_id", "user_managers", ["user_id"])
    op.create_index("idx_user_managers_manager_id", "user_managers", ["manager_id"])

    # New columns on users
    op.add_column("users", sa.Column("hire_date", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("position", sa.String(length=150), nullable=True))

    # Migrate existing manager_id relationships into user_managers
    op.execute(
        """
        INSERT INTO user_managers (user_id, manager_id)
        SELECT id, manager_id FROM users
        WHERE manager_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_column("users", "position")
    op.drop_column("users", "hire_date")
    op.drop_index("idx_user_managers_manager_id", table_name="user_managers")
    op.drop_index("idx_user_managers_user_id", table_name="user_managers")
    op.drop_table("user_managers")
