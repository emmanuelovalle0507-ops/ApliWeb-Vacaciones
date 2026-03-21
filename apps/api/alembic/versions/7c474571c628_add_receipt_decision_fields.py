"""add receipt decision fields

Revision ID: 7c474571c628
Revises: 20260310_0009
Create Date: 2026-03-20 18:17:31.193578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7c474571c628'
down_revision: Union[str, None] = '20260310_0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Create the enum type for receipt decisions
receipt_decision_enum = sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='receipt_decision')


def upgrade() -> None:
    receipt_decision_enum.create(op.get_bind(), checkfirst=True)
    op.add_column('expense_receipts', sa.Column('decision', receipt_decision_enum, server_default='PENDING', nullable=False))
    op.add_column('expense_receipts', sa.Column('decision_comment', sa.Text(), nullable=True))
    op.add_column('expense_receipts', sa.Column('decided_by', sa.UUID(), nullable=True))
    op.add_column('expense_receipts', sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_receipt_decided_by', 'expense_receipts', 'users', ['decided_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_receipt_decided_by', 'expense_receipts', type_='foreignkey')
    op.drop_column('expense_receipts', 'decided_at')
    op.drop_column('expense_receipts', 'decided_by')
    op.drop_column('expense_receipts', 'decision_comment')
    op.drop_column('expense_receipts', 'decision')
    receipt_decision_enum.drop(op.get_bind(), checkfirst=True)
