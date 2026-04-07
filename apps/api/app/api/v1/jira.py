from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user, require_roles
from app.schemas.auth import UserSummary
from app.services import jira_service

router = APIRouter(prefix="/jira", tags=["jira"])


@router.get("/test-connection")
def test_jira_connection(
    current_user: UserSummary = Depends(require_roles("ADMIN")),
):
    """Test the Jira API connection (admin only)."""
    return jira_service.test_connection()


@router.get("/employee-issues")
def get_employee_jira_issues(
    email: str = Query(..., description="Email del empleado en Jira"),
    start_date: date = Query(..., description="Fecha inicio (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Fecha fin (YYYY-MM-DD)"),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN", "HR")),
):
    """Fetch Jira issues assigned to an employee within a date range."""
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date debe ser anterior a end_date",
        )
    return jira_service.get_employee_issues(email, start_date, end_date)
