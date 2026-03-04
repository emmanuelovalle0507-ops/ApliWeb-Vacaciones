from datetime import date, datetime

from pydantic import BaseModel, Field


class VacationRequestCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str | None = None


class VacationRequestDecision(BaseModel):
    decision_comment: str | None = None


class VacationRequestOut(BaseModel):
    id: str
    team_id: str | None = None
    team_name: str | None = None
    employee_id: str
    employee_name: str | None = None
    manager_id: str
    manager_name: str | None = None
    start_date: date
    end_date: date
    requested_days: float
    status: str
    reason: str | None = None
    decision_comment: str | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime


class VacationApprovalResponse(BaseModel):
    request: VacationRequestOut
    balance: dict[str, float | str]


class VacationRequestList(BaseModel):
    items: list[VacationRequestOut] = Field(default_factory=list)


class PreValidateRequest(BaseModel):
    start_date: date
    end_date: date


class PreValidateResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    requested_days: float = 0
    balance_by_year: dict[int, dict[str, float]] = Field(default_factory=dict)
