from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.ai_chat_interaction import AIChatInteraction


class AIChatRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, item: AIChatInteraction) -> AIChatInteraction:
        self.db.add(item)
        self.db.flush()
        self.db.refresh(item)
        return item

    def list_recent_by_actor(self, actor_user_id: str, limit: int = 20) -> list[AIChatInteraction]:
        actor_uuid = UUID(actor_user_id)
        stmt = (
            select(AIChatInteraction)
            .where(AIChatInteraction.actor_user_id == actor_uuid)
            .order_by(AIChatInteraction.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars().all())
