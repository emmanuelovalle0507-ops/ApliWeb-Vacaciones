from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self.db.execute(stmt).scalar_one_or_none()

    def get_by_id(self, user_id: str) -> User | None:
        stmt = select(User).where(User.id == user_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(
        self,
        role: str | None = None,
        team_id: str | None = None,
        search: str | None = None,
    ) -> list[User]:
        stmt = select(User).order_by(User.full_name.asc())
        if role:
            stmt = stmt.where(User.role == role)
        if team_id:
            stmt = stmt.where(User.team_id == team_id)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
            )
        return list(self.db.execute(stmt).scalars().all())

    def list_by_manager_id(self, manager_id: str) -> list[User]:
        stmt = (
            select(User)
            .where(User.manager_id == manager_id, User.is_active.is_(True))
            .order_by(User.full_name.asc())
        )
        return list(self.db.execute(stmt).scalars().all())
