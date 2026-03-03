import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.schemas.ai_chat import AIChatHistoryItem, AIChatHistoryResponse, AIChatRequest, AIChatResponse
from app.schemas.auth import UserSummary
from app.services.ai_chat_service import AIChatService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/chat", tags=["ai-chat"])


@router.post("", response_model=AIChatResponse)
def ask_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER", "ADMIN", "HR")),
) -> AIChatResponse:
    service = AIChatService(db)
    try:
        result = service.ask(actor_id=current_user.id, question=payload.question)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Unexpected error in AI chat for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del asistente IA. Intenta de nuevo en unos momentos.",
        ) from exc

    return AIChatResponse(
        answer=result.answer,
        scope=result.scope,
        tool_results_used=result.tool_results_used,
        conversation_id=result.conversation_id,
    )


@router.get("/history", response_model=AIChatHistoryResponse)
def chat_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER", "ADMIN", "HR")),
) -> AIChatHistoryResponse:
    service = AIChatService(db)
    try:
        items = service.history(actor_id=current_user.id, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return AIChatHistoryResponse(
        items=[
            AIChatHistoryItem(
                id=item.id,
                question=item.question,
                answer=item.answer,
                scope=item.scope,
                role=getattr(item, "role", None),
                tools_used=getattr(item, "tools_used", None),
                latency_ms=getattr(item, "latency_ms", None),
                created_at=item.created_at,
            )
            for item in items
        ]
    )
