"""Add must_change_password flag to users.

Revision ID: 20260305_0007
Revises: 20260305_0006
Create Date: 2026-03-05
"""

from alembic import op
import sqlalchemy as sa

revision = "20260305_0007"
down_revision = "20260305_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
