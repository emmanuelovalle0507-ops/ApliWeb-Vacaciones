"""Add carried_over_days to vacation_balances.

Revision ID: 20260307_0008
Revises: 20260305_0007
Create Date: 2026-03-07
"""

from alembic import op
import sqlalchemy as sa

revision = "20260307_0008"
down_revision = "20260305_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vacation_balances",
        sa.Column("carried_over_days", sa.Numeric(6, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("vacation_balances", "carried_over_days")
