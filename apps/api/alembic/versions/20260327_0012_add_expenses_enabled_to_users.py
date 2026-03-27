"""add expenses_enabled to users

Revision ID: 20260327_0012
Revises: 20260324_0011
Create Date: 2026-03-27 08:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260327_0012"
down_revision = "20260324_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("expenses_enabled", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("users", "expenses_enabled")
