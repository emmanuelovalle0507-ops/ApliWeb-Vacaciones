"""create notifications table

Revision ID: 20260304_0005
Revises: 20260302_0004
Create Date: 2026-03-04 13:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260304_0005"
down_revision: Union[str, None] = "20260302_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    notification_type = sa.Enum(
        "REQUEST_CREATED", "REQUEST_APPROVED", "REQUEST_REJECTED",
        "REQUEST_CANCELLED", "POLICY_UPDATED",
        name="notification_type",
    )
    email_status = sa.Enum("PENDING", "SENT", "FAILED", "SKIPPED", name="email_status")

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", notification_type, nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("email_status", email_status, nullable=False, server_default="SKIPPED"),
        sa.Column("email_to", sa.String(255), nullable=True),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("idx_notifications_user_id", "notifications", ["user_id"])
    op.create_index("idx_notifications_user_unread", "notifications", ["user_id", "is_read"])


def downgrade() -> None:
    op.drop_index("idx_notifications_user_unread", table_name="notifications")
    op.drop_index("idx_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.execute("DROP TYPE IF EXISTS notification_type")
    op.execute("DROP TYPE IF EXISTS email_status")
