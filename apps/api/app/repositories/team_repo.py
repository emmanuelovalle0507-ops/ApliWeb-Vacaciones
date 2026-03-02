from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.team import Team


class TeamRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, team: Team) -> Team:
        self.db.add(team)
        self.db.flush()
        self.db.refresh(team)
        return team

    def get_by_id(self, team_id: str) -> Team | None:
        stmt = select(Team).where(Team.id == team_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_name(self, name: str) -> Team | None:
        stmt = select(Team).where(Team.name == name)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(self) -> list[Team]:
        stmt = select(Team).where(Team.is_active.is_(True)).order_by(Team.name.asc())
        return list(self.db.execute(stmt).scalars().all())
