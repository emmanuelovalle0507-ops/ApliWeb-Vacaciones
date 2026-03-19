from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.mappers.expense_mapper import expense_category_to_out, expense_receipt_to_out, expense_report_to_out
from app.repositories.expense_repo import ExpenseRepository
from app.schemas.auth import UserSummary
from app.schemas.expense import (
    ExpenseCategoryOut,
    ExpenseReceiptManualCreateIn,
    ExpenseReceiptOut,
    ExpenseReceiptUpdateIn,
    ExpenseReportCreateIn,
    ExpenseReportDecisionIn,
    ExpenseReportListOut,
    ExpenseReportOut,
    ExpenseReportUpdateIn,
)
from app.services.expense_service import ExpenseService

router = APIRouter(tags=["expenses"])


@router.get("/expenses/categories", response_model=list[ExpenseCategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN", "HR", "FINANCE")),
) -> list[ExpenseCategoryOut]:
    repo = ExpenseRepository(db)
    return [expense_category_to_out(item) for item in repo.list_categories()]


@router.get("/manager/expenses/reports", response_model=ExpenseReportListOut)
def list_manager_reports(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReportListOut:
    repo = ExpenseRepository(db)
    items = repo.list_reports_by_manager(current_user.id)
    return ExpenseReportListOut(items=[expense_report_to_out(item) for item in items])


@router.post("/manager/expenses/reports", response_model=ExpenseReportOut)
def create_manager_report(
    payload: ExpenseReportCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.create_report(current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.get("/manager/expenses/reports/{report_id}", response_model=ExpenseReportOut)
def get_manager_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReportOut:
    repo = ExpenseRepository(db)
    report = repo.get_report(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado")
    if current_user.role != "ADMIN" and str(report.manager_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este reporte")
    return expense_report_to_out(report, receipts=repo.list_receipts(report_id), actions=repo.list_actions(report_id))


@router.patch("/manager/expenses/reports/{report_id}", response_model=ExpenseReportOut)
def update_manager_report(
    report_id: str,
    payload: ExpenseReportUpdateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.update_report(report_id, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.post("/manager/expenses/reports/{report_id}/submit", response_model=ExpenseReportOut)
def submit_manager_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.submit_report(report_id, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.post("/manager/expenses/reports/{report_id}/receipts", response_model=ExpenseReceiptOut)
async def upload_receipt(
    report_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("INVOICE"),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReceiptOut:
    service = ExpenseService(db)
    try:
        receipt = await service.upload_receipt(report_id, current_user, file, document_type=document_type)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return expense_receipt_to_out(receipt)


@router.post("/manager/expenses/reports/{report_id}/receipts/manual", response_model=ExpenseReceiptOut)
def create_manual_receipt(
    report_id: str,
    payload: ExpenseReceiptManualCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReceiptOut:
    service = ExpenseService(db)
    try:
        receipt = service.create_manual_receipt(report_id, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return expense_receipt_to_out(receipt)


@router.get("/manager/expenses/reports/{report_id}/receipts", response_model=list[ExpenseReceiptOut])
def list_report_receipts(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> list[ExpenseReceiptOut]:
    repo = ExpenseRepository(db)
    report = repo.get_report(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado")
    if current_user.role != "ADMIN" and str(report.manager_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este reporte")
    return [expense_receipt_to_out(item) for item in repo.list_receipts(report_id)]


@router.post("/manager/expenses/receipts/{receipt_id}/analyze", response_model=ExpenseReceiptOut)
def analyze_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReceiptOut:
    service = ExpenseService(db)
    try:
        receipt = service.analyze_receipt(receipt_id, current_user)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return expense_receipt_to_out(receipt)


@router.patch("/manager/expenses/receipts/{receipt_id}", response_model=ExpenseReceiptOut)
def update_receipt(
    receipt_id: str,
    payload: ExpenseReceiptUpdateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ExpenseReceiptOut:
    service = ExpenseService(db)
    try:
        receipt = service.update_receipt(receipt_id, current_user, payload)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_receipt_to_out(receipt)


@router.get("/finance/expenses/reports", response_model=ExpenseReportListOut)
def list_finance_reports(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseReportListOut:
    repo = ExpenseRepository(db)
    items = repo.list_reports_for_finance(status=status)
    return ExpenseReportListOut(items=[expense_report_to_out(item) for item in items])


@router.get("/finance/expenses/reports/{report_id}", response_model=ExpenseReportOut)
def get_finance_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseReportOut:
    repo = ExpenseRepository(db)
    report = repo.get_report(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado")
    return expense_report_to_out(report, receipts=repo.list_receipts(report_id), actions=repo.list_actions(report_id))


@router.post("/finance/expenses/reports/{report_id}/approve", response_model=ExpenseReportOut)
def approve_finance_report(
    report_id: str,
    payload: ExpenseReportDecisionIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.approve_report(report_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.post("/finance/expenses/reports/{report_id}/reject", response_model=ExpenseReportOut)
def reject_finance_report(
    report_id: str,
    payload: ExpenseReportDecisionIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.reject_report(report_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.post("/finance/expenses/reports/{report_id}/request-correction", response_model=ExpenseReportOut)
def request_correction_finance_report(
    report_id: str,
    payload: ExpenseReportDecisionIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("FINANCE", "ADMIN")),
) -> ExpenseReportOut:
    service = ExpenseService(db)
    try:
        report = service.request_correction(report_id, current_user, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return expense_report_to_out(report)


@router.get("/admin/expenses/reports", response_model=ExpenseReportListOut)
def list_admin_reports(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> ExpenseReportListOut:
    repo = ExpenseRepository(db)
    items = repo.list_reports_for_admin(status=status)
    return ExpenseReportListOut(items=[expense_report_to_out(item) for item in items])


@router.get("/admin/expenses/dashboard/summary", response_model=dict[str, int])
def admin_expense_summary(
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("ADMIN", "HR")),
) -> dict[str, int]:
    repo = ExpenseRepository(db)
    return repo.get_summary_counts()
