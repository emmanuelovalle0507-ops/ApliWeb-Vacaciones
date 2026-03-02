from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.team_policy import TeamPolicy


class TeamPolicyRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, policy: TeamPolicy) -> TeamPolicy:
        self.db.add(policy)
        self.db.flush()
        self.db.refresh(policy)
        return policy

    def get_active_for_date(self, team_id: str, target_date: date) -> TeamPolicy | None:
        stmt = (
            select(TeamPolicy)
            .where(
                TeamPolicy.team_id == team_id,
                TeamPolicy.effective_from <= target_date,
                (TeamPolicy.effective_to.is_(None) | (TeamPolicy.effective_to >= target_date)),
            )
            .order_by(TeamPolicy.effective_from.desc(), TeamPolicy.id.desc())
        )
        return self.db.execute(stmt).scalars().first()

    def list_for_team(self, team_id: str) -> list[TeamPolicy]:
        stmt = select(TeamPolicy).where(TeamPolicy.team_id == team_id).order_by(TeamPolicy.effective_from.desc())
        return list(self.db.execute(stmt).scalars().all())
