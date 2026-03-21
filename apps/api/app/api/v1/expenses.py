"""Expenses endpoints — receipt upload, reports CRUD, manager flow."""

from __future__ import annotations

import uuid as _uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.expense_receipt import ExpenseReceipt, ExtractionStatus
from app.models.expense_report import ExpenseReport, ExpenseReportStatus
from app.repositories.audit_repo import AuditRepository
from app.repositories.expense_receipt_repo import ExpenseReceiptRepository
from app.repositories.expense_report_repo import ExpenseReportRepository
from app.repositories.user_repo import UserRepository
from app.repositories.team_repo import TeamRepository
from app.schemas.auth import UserSummary
from app.schemas.expense import (
    DecisionIn,
    ExpenseAnalytics,
    ManualReceiptIn,
    PaginatedReceiptList,
    PaginatedReportList,
    ReceiptOut,
    ReceiptUpdateIn,
    ReportCreateIn,
    ReportOut,
    ReportUpdateIn,
)
from app.schemas.pagination import PaginationMeta, PaginationParams
from app.services.storage_service import StorageService
from app.db.session import SessionLocal

router = APIRouter(prefix="/expenses", tags=["expenses"])

_storage = StorageService()


def _optional_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> UserSummary | None:
    """Try to extract user from Authorization header; return None if absent/invalid."""
    from app.core.security import decode_access_token
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    raw_token = auth[7:]
    try:
        payload = decode_access_token(raw_token)
        uid = payload.get("sub")
        if not uid:
            return None
        u = UserRepository(db).get_by_id(uid)
        if not u or not u.is_active:
            return None
        return UserSummary(
            id=str(u.id), full_name=u.full_name, email=u.email,
            role=u.role.value, team_id=str(u.team_id) if u.team_id else None,
            team_name=None,
        )
    except Exception:
        return None


def _valid_uuid(val: str) -> bool:
    try:
        _uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False


def _run_extraction(receipt_id: str) -> None:
    """Background task: run AI extraction on a receipt in its own DB session."""
    import logging
    logger = logging.getLogger(__name__)
    db = SessionLocal()
    try:
        from app.services.receipt_extraction_service import ReceiptExtractionService
        svc = ReceiptExtractionService(db)
        ok = svc.process_receipt(receipt_id)
        db.commit()
        logger.info("BG extraction receipt=%s success=%s", receipt_id, ok)
    except Exception as exc:
        logger.exception("BG extraction failed receipt=%s: %s", receipt_id, exc)
        db.rollback()
    finally:
        db.close()


# ── Helpers ────────────────────────────────────────────
def _receipt_to_out(r: ExpenseReceipt) -> ReceiptOut:
    return ReceiptOut(
        id=str(r.id),
        reportId=str(r.report_id) if r.report_id else None,
        ownerId=str(r.owner_id),
        fileUrl=f"/api/v1/expenses/files/{r.file_url}",
        fileName=r.file_name,
        fileContentType=r.file_content_type,
        fileSizeBytes=r.file_size_bytes,
        ocrText=r.ocr_text,
        extractionJson=r.extraction_json,
        extractionStatus=r.extraction_status.value,
        extractionConfidence=float(r.extraction_confidence) if r.extraction_confidence else None,
        vendorName=r.vendor_name,
        receiptDate=r.receipt_date,
        totalAmount=float(r.total_amount) if r.total_amount else None,
        currency=r.currency,
        taxAmount=float(r.tax_amount) if r.tax_amount else None,
        paymentMethod=r.payment_method,
        category=r.category.value if r.category else None,
        description=r.description,
        decision=r.decision.value if r.decision else "PENDING",
        decisionComment=r.decision_comment,
        decidedBy=str(r.decided_by) if r.decided_by else None,
        decidedAt=r.decided_at,
        createdAt=r.created_at,
        updatedAt=r.updated_at,
    )


def _report_to_out(
    r: ExpenseReport,
    db: Session,
    include_receipts: bool = False,
) -> ReportOut:
    owner_name = None
    team_name = None
    u = UserRepository(db).get_by_id(str(r.owner_id))
    if u:
        owner_name = u.full_name
    if r.team_id:
        t = TeamRepository(db).get_by_id(str(r.team_id))
        if t:
            team_name = t.name
    all_receipts = r.receipts or []
    receipts = []
    if include_receipts and all_receipts:
        receipts = [_receipt_to_out(rc) for rc in all_receipts]
    return ReportOut(
        id=str(r.id),
        ownerId=str(r.owner_id),
        ownerName=owner_name,
        teamId=str(r.team_id) if r.team_id else None,
        teamName=team_name,
        title=r.title,
        periodStart=r.period_start,
        periodEnd=r.period_end,
        status=r.status.value,
        totalAmount=float(r.total_amount) if r.total_amount else None,
        currency=r.currency,
        submittedAt=r.submitted_at,
        decisionComment=r.decision_comment,
        decidedBy=str(r.decided_by) if r.decided_by else None,
        decidedAt=r.decided_at,
        paymentStatus=r.payment_status.value if r.payment_status else "PENDING",
        paymentProofUrl=f"/api/v1/finance/reports/{r.id}/payment-proof" if r.payment_proof_file else None,
        paidAt=r.paid_at,
        paidBy=str(r.paid_by) if r.paid_by else None,
        createdAt=r.created_at,
        updatedAt=r.updated_at,
        receipts=receipts,
        receiptCount=len(all_receipts),
    )


# ── Receipt Upload ─────────────────────────────────────
@router.post("/receipts/upload", response_model=list[ReceiptOut], status_code=status.HTTP_201_CREATED)
async def upload_receipts(
    files: list[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
):
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se proporcionaron archivos.")
    if len(files) > 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Máximo 10 archivos a la vez.")

    repo = ExpenseReceiptRepository(db)
    audit = AuditRepository(db)
    results: list[ReceiptOut] = []

    for f in files:
        data = await f.read()
        content_type = f.content_type or "application/octet-stream"
        try:
            _storage.validate(content_type, len(data), data)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

        key = _storage.save(data, current_user.id, f.filename or "file", content_type)

        receipt = ExpenseReceipt(
            owner_id=current_user.id,
            file_url=key,
            file_name=f.filename or "file",
            file_content_type=content_type,
            file_size_bytes=len(data),
            extraction_status=ExtractionStatus.PENDING,
        )
        receipt = repo.add(receipt)

        audit.log(
            actor_user_id=current_user.id,
            action="RECEIPT_UPLOADED",
            entity_type="expense_receipt",
            entity_id=str(receipt.id),
            metadata={"file_name": f.filename, "size": len(data)},
        )
        results.append(_receipt_to_out(receipt))

    db.commit()

    # Dispatch background AI extraction for each receipt
    for r in results:
        background_tasks.add_task(_run_extraction, r.id)

    return results


# ── Receipt List (mine) ────────────────────────────────
@router.get("/receipts", response_model=PaginatedReceiptList)
def list_my_receipts(
    report_id: str | None = Query(None),
    unassigned: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
    pagination: PaginationParams = Depends(),
) -> PaginatedReceiptList:
    repo = ExpenseReceiptRepository(db)
    items, total = repo.list_by_owner(
        current_user.id,
        report_id=report_id,
        unassigned_only=unassigned,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return PaginatedReceiptList(
        items=[_receipt_to_out(r) for r in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


# ── Receipt Detail ─────────────────────────────────────
@router.get("/receipts/{receipt_id}", response_model=ReceiptOut)
def get_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "FINANCE", "ADMIN")),
) -> ReceiptOut:
    repo = ExpenseReceiptRepository(db)
    receipt = repo.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    # Ownership check for MANAGER
    if current_user.role == "MANAGER" and str(receipt.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este ticket.")
    return _receipt_to_out(receipt)


# ── Receipt Update (correct AI fields) ────────────────
@router.patch("/receipts/{receipt_id}", response_model=ReceiptOut)
def update_receipt(
    receipt_id: str,
    payload: ReceiptUpdateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER")),
) -> ReceiptOut:
    repo = ExpenseReceiptRepository(db)
    receipt = repo.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    if str(receipt.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este ticket.")

    # Block editing if the receipt belongs to an APPROVED or REJECTED report
    if receipt.report_id:
        from app.repositories.expense_report_repo import ExpenseReportRepository
        report = ExpenseReportRepository(db).get_by_id(str(receipt.report_id))
        if report and report.status.value in ("APPROVED", "REJECTED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede editar un ticket en un reporte {report.status.value.lower()}.",
            )

    changes = payload.model_dump(exclude_none=True)
    if changes:
        repo.update_extraction(
            receipt_id,
            status=receipt.extraction_status,
            vendor_name=changes.get("vendorName"),
            receipt_date=changes.get("receiptDate"),
            total_amount=changes.get("totalAmount"),
            currency=changes.get("currency"),
            tax_amount=changes.get("taxAmount"),
            payment_method=changes.get("paymentMethod"),
            category=changes.get("category"),
            description=changes.get("description"),
        )
        AuditRepository(db).log(
            actor_user_id=current_user.id,
            action="RECEIPT_CORRECTED",
            entity_type="expense_receipt",
            entity_id=receipt_id,
            metadata={"changes": changes},
        )
        db.commit()
        receipt = repo.get_by_id(receipt_id)

    return _receipt_to_out(receipt)


# ── Report Create ──────────────────────────────────────
@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(
    payload: ReportCreateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ReportOut:
    user = UserRepository(db).get_by_id(current_user.id)
    report = ExpenseReport(
        owner_id=current_user.id,
        team_id=user.team_id if user else None,
        title=payload.title,
        period_start=payload.periodStart,
        period_end=payload.periodEnd,
        currency=payload.currency,
        status=ExpenseReportStatus.DRAFT,
    )
    repo = ExpenseReportRepository(db)
    report = repo.add(report)

    # Assign receipts to report
    if payload.receiptIds:
        receipt_repo = ExpenseReceiptRepository(db)
        total = Decimal("0")
        for rid in payload.receiptIds:
            if not _valid_uuid(rid):
                continue
            r = receipt_repo.get_by_id(rid)
            if not r:
                continue
            if str(r.owner_id) != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"No tienes acceso al ticket {rid[:8]}.",
                )
            if r.report_id is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El ticket '{r.vendor_name or r.file_name}' ya está asignado a otro reporte.",
                )
            r.report_id = report.id
            if r.total_amount:
                total += Decimal(str(r.total_amount))
        report.total_amount = float(total)

    AuditRepository(db).log(
        actor_user_id=current_user.id,
        action="REPORT_CREATED",
        entity_type="expense_report",
        entity_id=str(report.id),
        metadata={"title": payload.title, "receipts": len(payload.receiptIds)},
    )
    db.commit()
    db.refresh(report)
    return _report_to_out(report, db, include_receipts=True)


# ── Report List (mine) ─────────────────────────────────
@router.get("/reports", response_model=PaginatedReportList)
def list_my_reports(
    report_status: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
    pagination: PaginationParams = Depends(),
) -> PaginatedReportList:
    repo = ExpenseReportRepository(db)
    items, total = repo.list_by_owner(
        current_user.id,
        status=report_status,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return PaginatedReportList(
        items=[_report_to_out(r, db, include_receipts=True) for r in items],
        pagination=PaginationMeta.build(page=pagination.page, page_size=pagination.page_size, total=total),
    )


# ── Report Detail ──────────────────────────────────────
@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "FINANCE", "ADMIN")),
) -> ReportOut:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if current_user.role == "MANAGER" and str(report.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este reporte.")
    return _report_to_out(report, db, include_receipts=True)


# ── Report Update (DRAFT only) ────────────────────────
@router.patch("/reports/{report_id}", response_model=ReportOut)
def update_report(
    report_id: str,
    payload: ReportUpdateIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER")),
) -> ReportOut:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if str(report.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este reporte.")
    if report.status not in (ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CHANGES):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se pueden editar reportes en borrador o con correcciones solicitadas.")

    if payload.title is not None:
        report.title = payload.title
    if payload.periodStart is not None:
        report.period_start = payload.periodStart
    if payload.periodEnd is not None:
        report.period_end = payload.periodEnd
    db.commit()
    db.refresh(report)
    return _report_to_out(report, db, include_receipts=True)


# ── Report Submit ──────────────────────────────────────
@router.post("/reports/{report_id}/submit", response_model=ReportOut)
def submit_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER")),
) -> ReportOut:
    repo = ExpenseReportRepository(db)
    report = repo.get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")
    if str(report.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este reporte.")
    if report.status not in (ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CHANGES):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este reporte no puede ser enviado.")

    # Recalculate total from receipts (may have been edited during NEEDS_CHANGES)
    total = Decimal("0")
    for rc in (report.receipts or []):
        if rc.total_amount:
            total += Decimal(str(rc.total_amount))
    report.total_amount = float(total)

    report.status = ExpenseReportStatus.SUBMITTED
    report.submitted_at = datetime.now(timezone.utc)

    AuditRepository(db).log(
        actor_user_id=current_user.id,
        action="REPORT_SUBMITTED",
        entity_type="expense_report",
        entity_id=report_id,
    )
    db.commit()
    db.refresh(report)
    return _report_to_out(report, db, include_receipts=True)


# ── File Serve ─────────────────────────────────────────
from fastapi.responses import FileResponse


@router.get("/files/{file_key:path}")
def serve_file(
    file_key: str,
    token: str | None = Query(None, description="Auth token for img/embed tags"),
    db: Session = Depends(get_db),
    current_user: UserSummary | None = Depends(_optional_current_user),
):
    # Support token via query param (for <img> tags that can't send headers)
    if current_user is None and token:
        from app.core.security import decode_access_token
        from app.repositories.user_repo import UserRepository as UR
        try:
            payload = decode_access_token(token)
            uid = payload.get("sub")
            if uid:
                u = UR(db).get_by_id(uid)
                if u and u.is_active:
                    current_user = UserSummary(
                        id=str(u.id), full_name=u.full_name, email=u.email,
                        role=u.role.value, team_id=str(u.team_id) if u.team_id else None,
                        team_name=None,
                    )
        except Exception:
            pass

    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticación requerida.")

    path = _storage.get_full_path(file_key)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Archivo no encontrado.")
    # Basic ownership check: file_key contains owner_id
    # FINANCE and ADMIN can view any file for review purposes
    if current_user.role not in ("FINANCE", "ADMIN"):
        parts = file_key.split("/")
        if len(parts) >= 2 and parts[1] != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a este archivo.")
    return FileResponse(path)


# ── Manual Receipt (no file) ──────────────────────────
@router.post("/receipts/manual", response_model=ReceiptOut, status_code=status.HTTP_201_CREATED)
def create_manual_receipt(
    payload: ManualReceiptIn,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ReceiptOut:
    from app.models.expense_receipt import ExpenseCategory

    category_enum = None
    if payload.category:
        try:
            category_enum = ExpenseCategory(payload.category)
        except ValueError:
            pass

    receipt = ExpenseReceipt(
        owner_id=current_user.id,
        file_url="manual",
        file_name="manual_entry",
        file_content_type="application/manual",
        file_size_bytes=0,
        extraction_status=ExtractionStatus.DONE,
        extraction_confidence=1.0,
        vendor_name=payload.vendorName,
        receipt_date=payload.receiptDate,
        total_amount=payload.totalAmount,
        currency=payload.currency,
        tax_amount=payload.taxAmount,
        payment_method=payload.paymentMethod,
        category=category_enum,
        description=payload.description,
    )
    repo = ExpenseReceiptRepository(db)
    receipt = repo.add(receipt)

    AuditRepository(db).log(
        actor_user_id=current_user.id,
        action="RECEIPT_MANUAL_CREATED",
        entity_type="expense_receipt",
        entity_id=str(receipt.id),
        metadata={"vendor": payload.vendorName, "amount": payload.totalAmount},
    )
    db.commit()
    db.refresh(receipt)
    return _receipt_to_out(receipt)


# ── Delete Receipt ────────────────────────────────────
@router.delete("/receipts/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
):
    repo = ExpenseReceiptRepository(db)
    receipt = repo.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    if current_user.role == "MANAGER" and str(receipt.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este ticket.")
    if receipt.report_id is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede eliminar un ticket asignado a un reporte.")
    db.delete(receipt)
    AuditRepository(db).log(
        actor_user_id=current_user.id,
        action="RECEIPT_DELETED",
        entity_type="expense_receipt",
        entity_id=receipt_id,
    )
    db.commit()


# ── Re-run AI Extraction ─────────────────────────────
@router.post("/receipts/{receipt_id}/re-extract", response_model=ReceiptOut)
def re_extract_receipt(
    receipt_id: str,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: UserSummary = Depends(require_roles("MANAGER", "ADMIN")),
) -> ReceiptOut:
    repo = ExpenseReceiptRepository(db)
    receipt = repo.get_by_id(receipt_id)
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado.")
    if current_user.role == "MANAGER" and str(receipt.owner_id) != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a este ticket.")
    if receipt.file_url == "manual":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede re-extraer un ticket manual.")

    receipt.extraction_status = ExtractionStatus.PENDING
    db.commit()
    background_tasks.add_task(_run_extraction, receipt_id)
    db.refresh(receipt)
    return _receipt_to_out(receipt)
