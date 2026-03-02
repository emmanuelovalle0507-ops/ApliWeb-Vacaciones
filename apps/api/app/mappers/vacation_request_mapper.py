from sqlalchemy.orm import Session

from app.models.vacation_request import VacationRequest
from app.schemas.vacation_request import VacationRequestOut


def vacation_request_to_out(
    item: VacationRequest,
    employee_name: str | None = None,
    manager_name: str | None = None,
    team_name: str | None = None,
) -> VacationRequestOut:
    return VacationRequestOut(
        id=str(item.id),
        team_id=str(item.team_id) if item.team_id else None,
        team_name=team_name,
        employee_id=str(item.employee_id),
        employee_name=employee_name,
        manager_id=str(item.manager_id),
        manager_name=manager_name,
        start_date=item.start_date,
        end_date=item.end_date,
        requested_days=float(item.requested_days),
        status=item.status.value,
        reason=item.reason,
        decision_comment=item.decision_comment,
        approved_at=item.approved_at,
        rejected_at=item.rejected_at,
        cancelled_at=item.cancelled_at,
        created_at=item.created_at,
    )


def vacation_request_to_out_enriched(item: VacationRequest, db: Session) -> VacationRequestOut:
    from app.repositories.user_repo import UserRepository
    from app.repositories.team_repo import TeamRepository

    user_repo = UserRepository(db)
    team_repo = TeamRepository(db)

    emp = user_repo.get_by_id(str(item.employee_id))
    mgr = user_repo.get_by_id(str(item.manager_id))
    team = team_repo.get_by_id(str(item.team_id)) if item.team_id else None

    return vacation_request_to_out(
        item,
        employee_name=emp.full_name if emp else None,
        manager_name=mgr.full_name if mgr else None,
        team_name=team.name if team else None,
    )
