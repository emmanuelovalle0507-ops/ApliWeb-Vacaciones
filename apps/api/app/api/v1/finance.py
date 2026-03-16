"""Finance endpoints — review, approve, reject expense reports."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.expense_action import ExpenseAction
from app.models.expense_receipt import ExpenseReceipt
from app.models.expense_report import ExpenseReport, ExpenseReportStatus
from app.repositories.audit_repo import AuditRepository
from app.repositories.expense_report_repo import ExpenseReportRepository
from app.repositories.user_repo import UserRepository
from app.repositories.team_repo import TeamRepository
from app.schemas.auth import UserSummary
from app.schemas.expense import DecisionIn, ExpenseAnalytics, PaginatedReportList, ReportOut
from app.schemas.pagination import PaginationMeta, PaginationParams

# Re-use helper from expenses module
from app.api.v1.expenses import _report_to_out

router = APIRouter(prefix="/finance", tags=["finance"])


# ── Report List (all — for finance/admin) ──────────────
@router.get("/reports", response_model=PaginatedReportList)
def list_all_reports(
    report_status: str | None = Query(None, alias="status"),
    owner_id: str | None = Query(None),
    team_id: str | None = Query(None),
    search: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    include_receipts: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
    pagination: PaginationParams = Depends(),
) -> PaginatedReportList:
    repo = ExpenseReportRepository(db)
    items, total = repo.list_all(
        status=report_status,
        owner_id=owner_id,
        team_id=team_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return PaginatedReportList(
        items=[_report_to_out(r, db, include_receipts=include_receipts) for r in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


# ── Analytics / Summary ───────────────────────────────
@router.get("/analytics", response_model=ExpenseAnalytics)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseAnalytics:
    from sqlalchemy import select
    status_q = (
        select(ExpenseReport.status, sa_func.count(ExpenseReport.id).label("cnt"))
        .group_by(ExpenseReport.status)
    )
    by_status = {}
    for row in db.execute(status_q):
        by_status[row.status.value if hasattr(row.status, "value") else str(row.status)] = row.cnt

    total_reports = sum(by_status.values())

    # Totals from receipts
    receipt_stats = db.execute(
        select(
            sa_func.count(ExpenseReceipt.id).label("cnt"),
            sa_func.coalesce(sa_func.sum(ExpenseReceipt.total_amount), 0).label("total"),
            sa_func.coalesce(sa_func.sum(ExpenseReceipt.tax_amount), 0).label("tax"),
        )
    ).one()

    # By category
    cat_q = (
        select(ExpenseReceipt.category, sa_func.sum(ExpenseReceipt.total_amount).label("total"))
        .where(ExpenseReceipt.category.isnot(None))
        .group_by(ExpenseReceipt.category)
        .order_by(sa_func.sum(ExpenseReceipt.total_amount).desc())
    )
    by_category = {}
    for row in db.execute(cat_q):
        cat_val = row.category.value if hasattr(row.category, "value") else str(row.category)
        by_category[cat_val] = float(row.total or 0)

    # Top vendors
    vendor_q = (
        select(ExpenseReceipt.vendor_name, sa_func.sum(ExpenseReceipt.total_amount).label("total"), sa_func.count(ExpenseReceipt.id).label("cnt"))
        .where(ExpenseReceipt.vendor_name.isnot(None))
        .group_by(ExpenseReceipt.vendor_name)
        .order_by(sa_func.sum(ExpenseReceipt.total_amount).desc())
        .limit(10)
    )
    top_vendors = [{"name": r.vendor_name, "total": float(r.total or 0), "count": r.cnt} for r in db.execute(vendor_q)]

    return ExpenseAnalytics(
        totalReports=total_reports,
        totalReceipts=receipt_stats.cnt,
        totalAmount=float(receipt_stats.total),
        totalTax=float(receipt_stats.tax),
        byStatus=by_status,
        byCategory=by_category,
        topVendors=top_vendors,
    )


# ── Report Detail ──────────────────────────────────────
@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report_detail(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ReportOut:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    return _report_to_out(report, db, include_receipts=True)


def _decide_report(
    report_id: str,
    new_status: ExpenseReportStatus,
    action_name: str,
    payload: DecisionIn,
    db: Session,
    current_user: UserSummary,
) -> ReportOut:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if report.status != ExpenseReportStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se pueden revisar reportes con estatus SUBMITTED.",
        )

    report.status = new_status
    report.decided_by = current_user.id
    report.decided_at = datetime.now(timezone.utc)
    report.decision_comment = payload.comment

    # Expense action log
    action = ExpenseAction(
        actor_user_id=current_user.id,
        report_id=report.id,
        action=action_name,
        comment=payload.comment,
    )
    db.add(action)

    AuditRepository(db).log(
        actor_user_id=current_user.id,
        action=action_name,
        entity_type="expense_report",
        entity_id=report_id,
        metadata={"comment": payload.comment},
    )
    db.commit()
    db.refresh(report)
    return _report_to_out(report, db, include_receipts=True)


# ── Approve ────────────────────────────────────────────
@router.post("/reports/{report_id}/approve", response_model=ReportOut)
def approve_report(
    report_id: str,
    payload: DecisionIn = DecisionIn(),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ReportOut:
    return _decide_report(report_id, ExpenseReportStatus.APPROVED, "REPORT_APPROVED", payload, db, current_user)


# ── Reject ─────────────────────────────────────────────
@router.post("/reports/{report_id}/reject", response_model=ReportOut)
def reject_report(
    report_id: str,
    payload: DecisionIn = DecisionIn(),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ReportOut:
    return _decide_report(report_id, ExpenseReportStatus.REJECTED, "REPORT_REJECTED", payload, db, current_user)


# ── Needs Changes ──────────────────────────────────────
@router.post("/reports/{report_id}/needs-changes", response_model=ReportOut)
def needs_changes_report(
    report_id: str,
    payload: DecisionIn = DecisionIn(),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ReportOut:
    return _decide_report(report_id, ExpenseReportStatus.NEEDS_CHANGES, "REPORT_NEEDS_CHANGES", payload, db, current_user)


# ── Export CSV ─────────────────────────────────────────
@router.get("/reports/{report_id}/export")
def export_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> StreamingResponse:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["#", "Proveedor", "Fecha", "Categoría", "Monto", "Moneda", "Impuestos", "Método", "Descripción"])
    for i, r in enumerate(report.receipts or [], 1):
        writer.writerow([
            i,
            r.vendor_name or "",
            str(r.receipt_date) if r.receipt_date else "",
            r.category.value if r.category else "",
            float(r.total_amount) if r.total_amount else "",
            r.currency or "",
            float(r.tax_amount) if r.tax_amount else "",
            r.payment_method or "",
            r.description or "",
        ])

    return StreamingResponse(
        io.StringIO(buf.getvalue()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=reporte_gastos_{report_id[:8]}.csv"},
    )
