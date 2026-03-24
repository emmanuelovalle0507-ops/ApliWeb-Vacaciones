"""add line_items to expense_receipts

Revision ID: 20260324_0011
Revises: 3ba8ed88a563
Create Date: 2026-03-24 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "20260324_0011"
down_revision = "3ba8ed88a563"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense_receipts", sa.Column("line_items", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("expense_receipts", "line_items")
