from sqlalchemy import delete, func, or_, select, Select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.user_manager import UserManager


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

    def list_all_paginated(
        self,
        *,
        role: str | None = None,
        team_id: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[User], int]:
        base = select(User)
        if role:
            base = base.where(User.role == role)
        if team_id:
            base = base.where(User.team_id == team_id)
        if search:
            pattern = f"%{search}%"
            base = base.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
        total = self._count(base)
        items = list(
            self.db.execute(
                base.order_by(User.full_name.asc()).offset(offset).limit(limit)
            ).scalars().all()
        )
        return items, total

    def _count(self, base_stmt: Select) -> int:
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        return self.db.execute(count_stmt).scalar_one()

    def list_by_manager_id(self, manager_id: str) -> list[User]:
        stmt = (
            select(User)
            .where(User.manager_id == manager_id, User.is_active.is_(True))
            .order_by(User.full_name.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def add(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        self.db.refresh(user)
        return user

    def get_manager_ids(self, user_id: str) -> list[str]:
        stmt = select(UserManager.manager_id).where(UserManager.user_id == user_id)
        rows = self.db.execute(stmt).scalars().all()
        return [str(mid) for mid in rows]

    def set_managers(self, user_id: str, manager_ids: list[str]) -> None:
        self.db.execute(delete(UserManager).where(UserManager.user_id == user_id))
        for mid in manager_ids:
            self.db.add(UserManager(user_id=user_id, manager_id=mid))
        self.db.flush()

    def is_manager_of(self, manager_id: str, employee_id: str) -> bool:
        stmt = select(UserManager).where(
            UserManager.user_id == employee_id,
            UserManager.manager_id == manager_id,
        )
        return self.db.execute(stmt).scalar_one_or_none() is not None

    def list_employees_of_manager(self, manager_id: str) -> list[User]:
        stmt = (
            select(User)
            .join(UserManager, User.id == UserManager.user_id)
            .where(UserManager.manager_id == manager_id, User.is_active.is_(True))
            .order_by(User.full_name.asc())
        )
        return list(self.db.execute(stmt).scalars().all())
