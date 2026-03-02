"""add teams and team policy scope

Revision ID: 20260226_0002
Revises: 20260224_0001
Create Date: 2026-02-26 22:55:00.000000
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260226_0002"
down_revision: Union[str, None] = "20260224_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    default_team_id = uuid.uuid4()
    teams_table = sa.table(
        "teams",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String(length=120)),
        sa.column("is_active", sa.Boolean()),
    )
    op.bulk_insert(
        teams_table,
        [{"id": default_team_id, "name": "General", "is_active": True}],
    )

    op.add_column("users", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(sa.text("UPDATE users SET team_id = :team_id WHERE team_id IS NULL").bindparams(team_id=default_team_id))
    op.create_foreign_key("fk_users_team_id", "users", "teams", ["team_id"], ["id"], ondelete="SET NULL")
    op.create_index("idx_users_team_id", "users", ["team_id"])

    op.add_column("vacation_requests", sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(
        """
        UPDATE vacation_requests vr
        SET team_id = u.team_id
        FROM users u
        WHERE vr.employee_id = u.id AND vr.team_id IS NULL
        """
    )
    op.create_foreign_key(
        "fk_vacation_requests_team_id",
        "vacation_requests",
        "teams",
        ["team_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("idx_requests_team_id", "vacation_requests", ["team_id"])

    op.create_table(
        "team_policies",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("max_people_off_per_day", sa.Integer(), nullable=False),
        sa.Column("min_notice_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("max_people_off_per_day > 0", name="chk_team_policy_daily_capacity_positive"),
        sa.CheckConstraint("min_notice_days >= 0", name="chk_team_policy_min_notice_non_negative"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_team_policies_team_id", "team_policies", ["team_id"])
    op.create_index("idx_team_policies_effective_from", "team_policies", ["effective_from"])


def downgrade() -> None:
    op.drop_index("idx_team_policies_effective_from", table_name="team_policies")
    op.drop_index("idx_team_policies_team_id", table_name="team_policies")
    op.drop_table("team_policies")

    op.drop_index("idx_requests_team_id", table_name="vacation_requests")
    op.drop_constraint("fk_vacation_requests_team_id", "vacation_requests", type_="foreignkey")
    op.drop_column("vacation_requests", "team_id")

    op.drop_index("idx_users_team_id", table_name="users")
    op.drop_constraint("fk_users_team_id", "users", type_="foreignkey")
    op.drop_column("users", "team_id")

    op.drop_table("teams")
