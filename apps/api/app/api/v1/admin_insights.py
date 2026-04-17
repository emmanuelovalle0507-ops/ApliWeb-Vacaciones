"""Admin insights endpoints: aggregated stats, system health, and activity feed."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.expense_report import ExpenseReport, ExpenseReportStatus
from app.models.user import User
from app.models.vacation_balance import VacationBalance
from app.models.vacation_request import VacationRequest, VacationRequestStatus
from app.schemas.auth import UserSummary

router = APIRouter(prefix="/admin", tags=["admin-insights"])


# ── Stats ──────────────────────────────────────────────────────────
@router.get("/stats")
def admin_stats(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN")),
) -> dict:
    """Aggregated KPIs for the admin dashboard."""
    today = date.today()
    year = today.year
    month_start = date(year, today.month, 1)
    # next month first day
    if today.month == 12:
        month_end = date(year, 12, 31)
    else:
        month_end = date(year, today.month + 1, 1) - timedelta(days=1)

    # Users
    active_users = db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0

    # Requests
    pending_requests = (
        db.query(func.count(VacationRequest.id))
        .filter(VacationRequest.status == VacationRequestStatus.PENDING)
        .scalar() or 0
    )
    approved_this_month = (
        db.query(func.count(VacationRequest.id))
        .filter(
            VacationRequest.status == VacationRequestStatus.APPROVED,
            VacationRequest.start_date >= month_start,
            VacationRequest.start_date <= month_end,
        )
        .scalar() or 0
    )

    # Balance utilization (current year)
    bal_agg = (
        db.query(
            func.coalesce(func.sum(VacationBalance.available_days + VacationBalance.used_days + VacationBalance.carried_over_days), 0),
            func.coalesce(func.sum(VacationBalance.used_days), 0),
        )
        .filter(VacationBalance.year == year)
        .one()
    )
    total_granted = float(bal_agg[0] or 0)
    total_used = float(bal_agg[1] or 0)
    utilization_pct = round((total_used / total_granted * 100)) if total_granted > 0 else 0

    # Expense reports pending finance review
    finance_pending = (
        db.query(func.count(ExpenseReport.id))
        .filter(ExpenseReport.status == ExpenseReportStatus.SUBMITTED)
        .scalar() or 0
    )

    # New hires this month
    new_hires_month = (
        db.query(func.count(User.id))
        .filter(
            User.hire_date >= month_start,
            User.hire_date <= month_end,
        )
        .scalar() or 0
    )

    return {
        "active_users": int(active_users),
        "total_users": int(total_users),
        "pending_requests": int(pending_requests),
        "approved_this_month": int(approved_this_month),
        "utilization_pct": int(utilization_pct),
        "total_granted_days": total_granted,
        "total_used_days": total_used,
        "finance_pending": int(finance_pending),
        "new_hires_month": int(new_hires_month),
        "year": year,
    }


# ── Health ─────────────────────────────────────────────────────────
@router.get("/health")
def admin_health(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN")),
) -> dict:
    """Detailed system health for admin — DB, integrations, queues."""
    # DB check
    db_ok = False
    db_error: str | None = None
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_error = str(e)[:200]

    # DB size / row counts
    users_count = db.query(func.count(User.id)).scalar() or 0
    audit_count = db.query(func.count(AuditLog.id)).scalar() or 0

    # Integrations
    openai_configured = settings.llm_enabled and bool(settings.openai_api_key)
    jira_configured = bool(settings.jira_base_url and settings.jira_user_email and settings.jira_api_token)
    smtp_configured = settings.smtp_enabled and bool(settings.smtp_user)

    # Recent errors (audit actions tagged as failures)
    recent_failures = (
        db.query(func.count(AuditLog.id))
        .filter(AuditLog.action.in_(["LOGIN_FAILED"]))
        .filter(AuditLog.created_at >= datetime.now(timezone.utc) - timedelta(hours=24))
        .scalar() or 0
    )

    components = [
        {
            "name": "Database",
            "status": "healthy" if db_ok else "down",
            "detail": f"{users_count} usuarios, {audit_count} audit entries" if db_ok else (db_error or "unreachable"),
        },
        {
            "name": "OpenAI (LLM)",
            "status": "healthy" if openai_configured else "disabled",
            "detail": f"Modelo: {settings.openai_model}" if openai_configured else "No configurado",
        },
        {
            "name": "Jira",
            "status": "healthy" if jira_configured else "disabled",
            "detail": settings.jira_base_url or "No configurado",
        },
        {
            "name": "Email (SMTP)",
            "status": "healthy" if smtp_configured else "disabled",
            "detail": f"{settings.smtp_host}:{settings.smtp_port}" if smtp_configured else "No configurado",
        },
        {
            "name": "Logins fallidos (24h)",
            "status": "warning" if recent_failures > 10 else "healthy",
            "detail": f"{recent_failures} intentos en las últimas 24h",
        },
    ]

    overall = "healthy"
    if any(c["status"] == "down" for c in components):
        overall = "degraded"
    elif any(c["status"] == "warning" for c in components):
        overall = "warning"

    return {
        "overall": overall,
        "env": settings.app_env,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "components": components,
    }


# ── Activity feed ──────────────────────────────────────────────────
@router.get("/activity-feed")
def admin_activity_feed(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN")),
) -> dict:
    """Recent activity across the system — last N audit entries with actor info."""
    rows = (
        db.query(AuditLog, User.full_name)
        .outerjoin(User, AuditLog.actor_user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    items = []
    for audit, actor_name in rows:
        items.append({
            "id": audit.id,
            "action": audit.action,
            "entity_type": audit.entity_type,
            "entity_id": audit.entity_id,
            "actor_name": actor_name,
            "metadata": audit.metadata_ or {},
            "created_at": audit.created_at.isoformat(),
        })

    return {"items": items}
