from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.schemas.ai_chat import AIChatHistoryItem, AIChatHistoryResponse, AIChatRequest, AIChatResponse
from app.schemas.auth import UserSummary
from app.services.ai_chat_service import AIChatService

router = APIRouter(prefix="/ai/chat", tags=["ai-chat"])


@router.post("", response_model=AIChatResponse)
def ask_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> AIChatResponse:
    service = AIChatService(db)
    try:
        result = service.ask(actor_id=current_user.id, question=payload.question)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return AIChatResponse(answer=result.answer, scope=result.scope)


@router.get("/history", response_model=AIChatHistoryResponse)
def chat_history(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> AIChatHistoryResponse:
    service = AIChatService(db)
    try:
        items = service.history(actor_id=current_user.id, limit=limit)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return AIChatHistoryResponse(
        items=[
            AIChatHistoryItem(
                id=item.id,
                question=item.question,
                answer=item.answer,
                scope=item.scope,
                created_at=item.created_at,
            )
            for item in items
        ]
    )
