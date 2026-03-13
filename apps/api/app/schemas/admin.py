from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.pagination import PaginationMeta


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    team_id: str | None = None
    team_name: str | None = None
    manager_id: str | None = None
    manager_ids: list[str] = Field(default_factory=list)
    is_active: bool
    hire_date: date | None = None
    position: str | None = None
    created_at: datetime


class UserListOut(BaseModel):
    items: list[UserOut] = Field(default_factory=list)


class PaginatedUserListOut(BaseModel):
    items: list[UserOut] = Field(default_factory=list)
    pagination: PaginationMeta


class TeamOut(BaseModel):
    id: str
    name: str
    is_active: bool


class TeamListOut(BaseModel):
    items: list[TeamOut] = Field(default_factory=list)


class BalanceWithUserOut(BaseModel):
    user_id: str
    user_name: str = ""
    user_area: str = ""
    year: int
    available_days: float
    used_days: float


class BalanceListOut(BaseModel):
    items: list[BalanceWithUserOut] = Field(default_factory=list)


class PaginatedBalanceListOut(BaseModel):
    items: list[BalanceWithUserOut] = Field(default_factory=list)
    pagination: PaginationMeta


class UserCreateIn(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(..., pattern=r"^(EMPLOYEE|MANAGER)$")
    team_id: str | None = None
    manager_ids: list[str] = Field(default_factory=list)
    hire_date: date | None = None
    position: str | None = Field(None, max_length=150)
    password: str = Field(..., min_length=4, max_length=128)


class AdminUserCreateIn(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(..., pattern=r"^(EMPLOYEE|MANAGER|ADMIN|HR)$")
    team_id: str | None = None
    manager_ids: list[str] = Field(default_factory=list)
    hire_date: date | None = None
    position: str | None = Field(None, max_length=150)
    password: str = Field(..., min_length=4, max_length=128)


class UserUpdateIn(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=150)
    role: str | None = None
    team_id: str | None = None
    manager_ids: list[str] | None = None
    hire_date: date | None = None
    position: str | None = Field(None, max_length=150)
    is_active: bool | None = None
