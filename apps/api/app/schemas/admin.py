from datetime import datetime

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    team_id: str | None = None
    team_name: str | None = None
    manager_id: str | None = None
    is_active: bool
    created_at: datetime


class UserListOut(BaseModel):
    items: list[UserOut] = Field(default_factory=list)


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
