"""add audit columns to ai_chat_interactions (role, tools_used, latency_ms)

Revision ID: 20260302_0004
Revises: 20260226_0003
Create Date: 2026-03-02 08:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260302_0004"
down_revision: Union[str, None] = "20260226_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_chat_interactions", sa.Column("role", sa.String(length=20), nullable=True))
    op.add_column("ai_chat_interactions", sa.Column("tools_used", sa.Text(), nullable=True))
    op.add_column("ai_chat_interactions", sa.Column("latency_ms", sa.Integer(), nullable=True))
    op.create_index("idx_ai_chat_role", "ai_chat_interactions", ["role"])


def downgrade() -> None:
    op.drop_index("idx_ai_chat_role", table_name="ai_chat_interactions")
    op.drop_column("ai_chat_interactions", "latency_ms")
    op.drop_column("ai_chat_interactions", "tools_used")
    op.drop_column("ai_chat_interactions", "role")
