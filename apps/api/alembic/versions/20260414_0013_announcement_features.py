"""Add reactions, comments, target_users, acknowledgment, approval, scheduling, attachments, archive

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-14 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- Announcement status enum --
    bind = op.get_bind()
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE announcement_status AS ENUM ('DRAFT','PENDING_APPROVAL','PUBLISHED','ARCHIVED'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;"
    ))

    # -- New columns on announcements --
    op.add_column('announcements', sa.Column('publish_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('announcements', sa.Column('requires_acknowledgment', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('announcements', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('announcements', sa.Column('status', postgresql.ENUM('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'ARCHIVED', name='announcement_status', create_type=False), nullable=False, server_default='PUBLISHED'))
    op.add_column('announcements', sa.Column('attachment_url', sa.String(500), nullable=True))
    op.add_column('announcements', sa.Column('attachment_name', sa.String(255), nullable=True))
    op.add_column('announcements', sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('announcements', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_announcements_approved_by', 'announcements', 'users', ['approved_by_id'], ['id'], ondelete='SET NULL')

    # -- New column on announcement_reads --
    op.add_column('announcement_reads', sa.Column('is_acknowledged', sa.Boolean(), nullable=False, server_default='false'))

    # -- Reactions table --
    op.create_table(
        'announcement_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('emoji', sa.String(10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('announcement_id', 'user_id', 'emoji', name='uq_announcement_user_emoji'),
    )

    # -- Comments table --
    op.create_table(
        'announcement_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # -- Target users table (custom audience) --
    op.create_table(
        'announcement_target_users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('announcement_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('announcements.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.UniqueConstraint('announcement_id', 'user_id', name='uq_announcement_target_user'),
    )


def downgrade() -> None:
    op.drop_table('announcement_target_users')
    op.drop_table('announcement_comments')
    op.drop_table('announcement_reactions')
    op.drop_column('announcement_reads', 'is_acknowledged')
    op.drop_constraint('fk_announcements_approved_by', 'announcements', type_='foreignkey')
    op.drop_column('announcements', 'approved_at')
    op.drop_column('announcements', 'approved_by_id')
    op.drop_column('announcements', 'attachment_name')
    op.drop_column('announcements', 'attachment_url')
    op.drop_column('announcements', 'status')
    op.drop_column('announcements', 'is_archived')
    op.drop_column('announcements', 'requires_acknowledgment')
    op.drop_column('announcements', 'publish_at')
    bind = op.get_bind()
    bind.execute(sa.text("DROP TYPE IF EXISTS announcement_status"))
