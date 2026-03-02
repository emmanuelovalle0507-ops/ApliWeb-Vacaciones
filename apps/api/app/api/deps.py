from collections.abc import Callable, Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import UserSummary

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def db_session() -> Generator[Session, None, None]:
    yield from get_db()


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> UserSummary:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    team_name = None
    if user.team_id:
        team = TeamRepository(db).get_by_id(str(user.team_id))
        if team:
            team_name = team.name

    return UserSummary(
        id=str(user.id),
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        team_id=str(user.team_id) if user.team_id else None,
        team_name=team_name,
    )


def require_roles(*allowed_roles: str) -> Callable:
    def _checker(current_user: UserSummary = Depends(get_current_user)) -> UserSummary:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _checker
