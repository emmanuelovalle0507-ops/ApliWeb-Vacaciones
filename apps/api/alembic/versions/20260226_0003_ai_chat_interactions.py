"""add ai chat interactions table

Revision ID: 20260226_0003
Revises: 20260226_0002
Create Date: 2026-02-26 23:12:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260226_0003"
down_revision: Union[str, None] = "20260226_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_chat_interactions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scope", sa.String(length=20), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_chat_actor_user_id", "ai_chat_interactions", ["actor_user_id"])
    op.create_index("idx_ai_chat_created_at", "ai_chat_interactions", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_ai_chat_created_at", table_name="ai_chat_interactions")
    op.drop_index("idx_ai_chat_actor_user_id", table_name="ai_chat_interactions")
    op.drop_table("ai_chat_interactions")
