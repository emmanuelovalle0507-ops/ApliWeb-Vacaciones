from datetime import date, timedelta
from calendar import monthrange

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.vacation_request import VacationRequest, VacationRequestStatus
from app.schemas.auth import UserSummary

router = APIRouter(prefix="/calendar", tags=["calendar"])


class CalendarEvent(BaseModel):
    request_id: str
    employee_id: str
    employee_name: str
    team_id: str | None = None
    start_date: date
    end_date: date
    status: str


class CalendarEventsResponse(BaseModel):
    month: str
    events: list[CalendarEvent] = Field(default_factory=list)


@router.get("/events", response_model=CalendarEventsResponse)
def get_calendar_events(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="Mes en formato YYYY-MM"),
    team_id: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(get_current_user),
) -> CalendarEventsResponse:
    year_int, month_int = int(month[:4]), int(month[5:7])
    _, last_day = monthrange(year_int, month_int)
    month_start = date(year_int, month_int, 1)
    month_end = date(year_int, month_int, last_day)

    stmt = (
        select(VacationRequest, User.full_name)
        .join(User, VacationRequest.employee_id == User.id)
        .where(
            VacationRequest.status.in_([
                VacationRequestStatus.APPROVED,
                VacationRequestStatus.PENDING,
            ]),
            VacationRequest.start_date <= month_end,
            VacationRequest.end_date >= month_start,
        )
    )

    if team_id:
        stmt = stmt.where(VacationRequest.team_id == team_id)
    elif current_user.role == "MANAGER":
        stmt = stmt.where(VacationRequest.manager_id == current_user.id)

    stmt = stmt.order_by(VacationRequest.start_date)
    rows = db.execute(stmt).all()

    events = [
        CalendarEvent(
            request_id=str(req.id),
            employee_id=str(req.employee_id),
            employee_name=full_name,
            team_id=str(req.team_id) if req.team_id else None,
            start_date=req.start_date,
            end_date=req.end_date,
            status=req.status.value,
        )
        for req, full_name in rows
    ]

    return CalendarEventsResponse(month=month, events=events)
