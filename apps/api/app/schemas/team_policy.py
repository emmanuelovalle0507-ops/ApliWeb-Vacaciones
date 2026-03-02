from datetime import date, datetime

from pydantic import BaseModel, Field


class TeamPolicyUpsertIn(BaseModel):
    team_id: str
    max_people_off_per_day: int = Field(gt=0)
    min_notice_days: int = Field(ge=0)
    effective_from: date
    effective_to: date | None = None


class TeamPolicyOut(BaseModel):
    id: int
    team_id: str
    max_people_off_per_day: int
    min_notice_days: int
    effective_from: date
    effective_to: date | None = None
    created_by: str | None = None
    created_at: datetime


class TeamPolicyAgentRequest(BaseModel):
    instruction: str = Field(min_length=5, max_length=2000)
    team_id: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    apply: bool = False


class TeamPolicyProposal(BaseModel):
    team_id: str
    max_people_off_per_day: int
    min_notice_days: int
    effective_from: date
    effective_to: date | None = None
    confidence: str
    notes: list[str] = Field(default_factory=list)


class TeamPolicyAgentResponse(BaseModel):
    proposal: TeamPolicyProposal
    applied: bool
    message: str
    policy: TeamPolicyOut | None = None


class TeamPolicyOnboardingQuestionsResponse(BaseModel):
    team_id: str
    has_active_policy: bool
    questions: list[str] = Field(default_factory=list)
