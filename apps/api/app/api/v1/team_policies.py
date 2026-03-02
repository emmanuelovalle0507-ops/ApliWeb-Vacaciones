from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.schemas.auth import UserSummary
from app.schemas.team_policy import (
    TeamPolicyAgentRequest,
    TeamPolicyAgentResponse,
    TeamPolicyOnboardingQuestionsResponse,
    TeamPolicyOut,
    TeamPolicyProposal,
    TeamPolicyUpsertIn,
)
from app.services.team_policy_agent_service import TeamPolicyAgentService
from app.services.vacation_request_service import VacationRequestService

router = APIRouter(prefix="/team-policies", tags=["team-policies"])


def _to_out(policy) -> TeamPolicyOut:
    return TeamPolicyOut(
        id=policy.id,
        team_id=str(policy.team_id),
        max_people_off_per_day=policy.max_people_off_per_day,
        min_notice_days=policy.min_notice_days,
        effective_from=policy.effective_from,
        effective_to=policy.effective_to,
        created_by=str(policy.created_by) if policy.created_by else None,
        created_at=policy.created_at,
    )


@router.get("/me", response_model=TeamPolicyOut)
def get_my_team_policy(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> TeamPolicyOut:
    service = VacationRequestService(db)
    try:
        policy = service.get_team_policy(current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _to_out(policy)


@router.get("/onboarding/questions", response_model=TeamPolicyOnboardingQuestionsResponse)
def onboarding_questions(
    team_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> TeamPolicyOnboardingQuestionsResponse:
    agent = TeamPolicyAgentService(db)
    try:
        resolved_team_id, has_active_policy, questions = agent.onboarding_questions(
            actor_id=current_user.id,
            requested_team_id=team_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return TeamPolicyOnboardingQuestionsResponse(
        team_id=resolved_team_id,
        has_active_policy=has_active_policy,
        questions=questions,
    )


@router.put("", response_model=TeamPolicyOut)
def upsert_team_policy(
    payload: TeamPolicyUpsertIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> TeamPolicyOut:
    service = VacationRequestService(db)
    try:
        policy = service.upsert_team_policy(
            actor_id=current_user.id,
            team_id=payload.team_id,
            max_people_off_per_day=payload.max_people_off_per_day,
            min_notice_days=payload.min_notice_days,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _to_out(policy)


@router.post("/agent", response_model=TeamPolicyAgentResponse)
def upsert_team_policy_by_agent(
    payload: TeamPolicyAgentRequest,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> TeamPolicyAgentResponse:
    agent = TeamPolicyAgentService(db)
    policy_service = VacationRequestService(db)

    try:
        proposal = agent.propose(
            actor_id=current_user.id,
            instruction=payload.instruction,
            requested_team_id=payload.team_id,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    proposal_out = TeamPolicyProposal(
        team_id=proposal.team_id,
        max_people_off_per_day=proposal.max_people_off_per_day,
        min_notice_days=proposal.min_notice_days,
        effective_from=proposal.effective_from,
        effective_to=proposal.effective_to,
        confidence=proposal.confidence,
        notes=proposal.notes,
    )

    if not payload.apply:
        return TeamPolicyAgentResponse(
            proposal=proposal_out,
            applied=False,
            message="Propuesta generada por el agente. Envíala con apply=true para guardarla.",
            policy=None,
        )

    try:
        policy = policy_service.upsert_team_policy(
            actor_id=current_user.id,
            team_id=proposal.team_id,
            max_people_off_per_day=proposal.max_people_off_per_day,
            min_notice_days=proposal.min_notice_days,
            effective_from=proposal.effective_from,
            effective_to=proposal.effective_to,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return TeamPolicyAgentResponse(
        proposal=proposal_out,
        applied=True,
        message="Política aplicada exitosamente desde instrucción agéntica.",
        policy=_to_out(policy),
    )
