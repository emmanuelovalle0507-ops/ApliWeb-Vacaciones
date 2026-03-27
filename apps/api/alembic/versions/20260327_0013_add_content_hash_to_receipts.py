"""add content_hash to expense_receipts for duplicate detection

Revision ID: 20260327_0013
Revises: 20260327_0012
Create Date: 2026-03-27 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "20260327_0013"
down_revision = "20260327_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense_receipts", sa.Column("content_hash", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_expense_receipts_content_hash", "expense_receipts", ["content_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_expense_receipts_content_hash", "expense_receipts", type_="unique")
    op.drop_column("expense_receipts", "content_hash")
