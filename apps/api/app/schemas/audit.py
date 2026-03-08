from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.pagination import PaginationMeta


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: str | None
    actor_name: str | None = None
    action: str
    entity_type: str
    entity_id: str
    metadata: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedAuditLogList(BaseModel):
    items: list[AuditLogOut]
    pagination: PaginationMeta
