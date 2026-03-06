from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import TokenResponse, UserSummary


class AuthService:
    def __init__(self, user_repo: UserRepository, team_repo: TeamRepository | None = None) -> None:
        self.user_repo = user_repo
        self.team_repo = team_repo

    def login(self, email: str, password: str) -> TokenResponse:
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Invalid credentials")

        team_name = None
        if user.team_id and self.team_repo:
            team = self.team_repo.get_by_id(str(user.team_id))
            if team:
                team_name = team.name

        token = create_access_token(subject=str(user.id), role=user.role.value)
        return TokenResponse(
            access_token=token,
            expires_in=settings.access_token_expire_minutes * 60,
            user=UserSummary(
                id=str(user.id),
                full_name=user.full_name,
                email=user.email,
                role=user.role.value,
                team_id=str(user.team_id) if user.team_id else None,
                team_name=team_name,
                must_change_password=user.must_change_password,
            ),
        )

    def me(self, user_id: str) -> UserSummary:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        team_name = None
        if user.team_id and self.team_repo:
            team = self.team_repo.get_by_id(str(user.team_id))
            if team:
                team_name = team.name
        return UserSummary(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            team_id=str(user.team_id) if user.team_id else None,
            team_name=team_name,
            must_change_password=user.must_change_password,
        )

    def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        user = self.user_repo.get_by_id(user_id)
        if not user:
            raise ValueError("Usuario no encontrado.")
        if not verify_password(current_password, user.password_hash):
            raise ValueError("La contraseña actual es incorrecta.")
        user.password_hash = hash_password(new_password)
        user.must_change_password = False
