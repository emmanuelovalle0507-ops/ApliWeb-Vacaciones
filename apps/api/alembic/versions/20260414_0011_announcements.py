"""Create announcements, announcement_teams, announcement_reads tables

Revision ID: a1b2c3d4e5f6
Revises: 8a2b3c4d5e6f
Create Date: 2026-04-14 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '20260329_0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the announcement_type enum (idempotent)
    bind = op.get_bind()
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE announcement_type AS ENUM ('GENERAL','URGENT','CELEBRATION','NEW_EMPLOYEE'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;"
    ))

    # announcements table
    op.create_table(
        'announcements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('type', postgresql.ENUM('GENERAL', 'URGENT', 'CELEBRATION', 'NEW_EMPLOYEE', name='announcement_type', create_type=False), nullable=False, server_default='GENERAL'),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('is_pinned', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_broadcast', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # announcement_teams table (M2M)
    op.create_table(
        'announcement_teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.UniqueConstraint('announcement_id', 'team_id', name='uq_announcement_team'),
    )

    # announcement_reads table
    op.create_table(
        'announcement_reads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('announcement_id', 'user_id', name='uq_announcement_user_read'),
    )


def downgrade() -> None:
    op.drop_table('announcement_reads')
    op.drop_table('announcement_teams')
    op.drop_table('announcements')
    sa.Enum(name='announcement_type').drop(op.get_bind(), checkfirst=True)
