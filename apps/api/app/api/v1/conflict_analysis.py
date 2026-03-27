from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.schemas.auth import UserSummary
from app.services.conflict_analysis_service import ConflictAnalysisService

router = APIRouter(prefix="/conflict-analysis", tags=["conflict-analysis"])


@router.get("/request/{request_id}")
def analyze_request_conflict(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN", "HR")),
):
    """Analyze team coverage conflicts for a pending vacation request."""
    service = ConflictAnalysisService(db)
    try:
        return service.analyze_conflict(request_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/suggest-dates")
def suggest_optimal_dates(
    desired_days: int = Query(..., ge=1, le=30),
    search_months: int = Query(default=3, ge=1, le=6),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("EMPLOYEE", "MANAGER")),
):
    """Suggest optimal date ranges with least team conflicts."""
    service = ConflictAnalysisService(db)
    try:
        return service.suggest_optimal_dates(
            employee_id=current_user.id,
            desired_days=desired_days,
            search_months=search_months,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
