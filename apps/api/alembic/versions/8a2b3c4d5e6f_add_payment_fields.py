"""add payment fields to expense_reports

Revision ID: 8a2b3c4d5e6f
Revises: 7c474571c628
Create Date: 2026-03-20 22:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8a2b3c4d5e6f'
down_revision: Union[str, None] = '7c474571c628'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the payment_status enum type
    payment_status_enum = sa.Enum('PENDING', 'PAID', name='payment_status')
    payment_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('expense_reports', sa.Column('payment_status',
        sa.Enum('PENDING', 'PAID', name='payment_status'),
        nullable=False, server_default='PENDING'))
    op.add_column('expense_reports', sa.Column('payment_proof_file',
        sa.String(500), nullable=True))
    op.add_column('expense_reports', sa.Column('payment_proof_content_type',
        sa.String(100), nullable=True))
    op.add_column('expense_reports', sa.Column('paid_at',
        sa.DateTime(timezone=True), nullable=True))
    op.add_column('expense_reports', sa.Column('paid_by',
        postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key('fk_expense_reports_paid_by', 'expense_reports',
        'users', ['paid_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_column('expense_reports', 'paid_by')
    op.drop_column('expense_reports', 'paid_at')
    op.drop_column('expense_reports', 'payment_proof_content_type')
    op.drop_column('expense_reports', 'payment_proof_file')
    op.drop_column('expense_reports', 'payment_status')
    sa.Enum('PENDING', 'PAID', name='payment_status').drop(op.get_bind(), checkfirst=True)
