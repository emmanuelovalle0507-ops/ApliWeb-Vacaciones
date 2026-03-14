from datetime import datetime

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = None


class AIChatResponse(BaseModel):
    answer: str
    scope: str
    tool_results_used: list[str] = Field(default_factory=list)
    conversation_id: str | None = None


class AIChatHistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    scope: str
    role: str | None = None
    tools_used: str | None = None
    latency_ms: int | None = None
    created_at: datetime


class AIChatHistoryResponse(BaseModel):
    items: list[AIChatHistoryItem] = Field(default_factory=list)
