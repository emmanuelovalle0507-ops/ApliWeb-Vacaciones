"""merge_cfdi_and_decisions

Revision ID: 3ba8ed88a563
Revises: 20260317_0010, 8a2b3c4d5e6f
Create Date: 2026-03-24 12:57:42.727925

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ba8ed88a563'
down_revision: Union[str, None] = ('20260317_0010', '8a2b3c4d5e6f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
