from datetime import datetime

from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)


class AIChatResponse(BaseModel):
    answer: str
    scope: str


class AIChatHistoryItem(BaseModel):
    id: int
    question: str
    answer: str
    scope: str
    created_at: datetime


class AIChatHistoryResponse(BaseModel):
    items: list[AIChatHistoryItem] = Field(default_factory=list)
