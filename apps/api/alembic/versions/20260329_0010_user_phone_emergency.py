"""Add phone and emergency_contact to users.

Revision ID: 20260329_0010
Revises: 8a2b3c4d5e6f
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "20260329_0010"
down_revision = "8a2b3c4d5e6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("emergency_contact", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "emergency_contact")
    op.drop_column("users", "phone")
