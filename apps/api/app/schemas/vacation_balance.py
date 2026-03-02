from pydantic import BaseModel


class VacationBalanceOut(BaseModel):
    user_id: str
    year: int
    available_days: float
    used_days: float


class BalanceAdjustmentIn(BaseModel):
    days_delta: float
    reason: str | None = None
