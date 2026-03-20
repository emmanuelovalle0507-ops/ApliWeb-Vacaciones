"""cfdi_fields_on_receipts

Revision ID: 20260317_0010
Revises: 20260310_0009
Create Date: 2026-03-17 18:08:27.077343

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260317_0010'
down_revision: Union[str, None] = '20260310_0009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('expense_receipts', sa.Column('is_cfdi', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('expense_receipts', sa.Column('uuid_fiscal', sa.String(length=36), nullable=True))
    op.add_column('expense_receipts', sa.Column('rfc_emisor', sa.String(length=13), nullable=True))
    op.add_column('expense_receipts', sa.Column('rfc_receptor', sa.String(length=13), nullable=True))
    op.add_column('expense_receipts', sa.Column('cfdi_xml_url', sa.String(length=500), nullable=True))
    op.create_unique_constraint('uq_expense_receipts_uuid_fiscal', 'expense_receipts', ['uuid_fiscal'])


def downgrade() -> None:
    op.drop_constraint('uq_expense_receipts_uuid_fiscal', 'expense_receipts', type_='unique')
    op.drop_column('expense_receipts', 'cfdi_xml_url')
    op.drop_column('expense_receipts', 'rfc_receptor')
    op.drop_column('expense_receipts', 'rfc_emisor')
    op.drop_column('expense_receipts', 'uuid_fiscal')
    op.drop_column('expense_receipts', 'is_cfdi')
