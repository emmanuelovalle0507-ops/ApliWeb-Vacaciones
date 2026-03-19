from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.expense import ExpenseAction, ExpenseActionType, ExpenseDocumentType, ExpenseReceipt, ExpenseReceiptStatus, ExpenseReport, ExpenseReportStatus, ExpenseReportType
from app.repositories.expense_repo import ExpenseRepository
from app.repositories.user_repo import UserRepository
from app.schemas.auth import UserSummary
from app.schemas.expense import ExpenseReceiptManualCreateIn, ExpenseReceiptUpdateIn, ExpenseReportCreateIn, ExpenseReportDecisionIn, ExpenseReportUpdateIn
from app.services.expense_file_service import ExpenseFileService
from app.services.expense_ocr_service import ExpenseOCRService


class ExpenseService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ExpenseRepository(db)
        self.user_repo = UserRepository(db)
        self.file_service = ExpenseFileService()
        self.ocr_service = ExpenseOCRService()

    def create_report(self, actor: UserSummary, payload: ExpenseReportCreateIn) -> ExpenseReport:
        employee_id = payload.employee_id or actor.id
        self._assert_manager_can_target_employee(actor, employee_id)

        report = ExpenseReport(
            manager_id=actor.id,
            employee_id=employee_id,
            team_id=payload.team_id or actor.team_id,
            vacation_request_id=payload.vacation_request_id,
            title=payload.title,
            description=payload.description,
            report_type=ExpenseReportType(payload.report_type),
            expense_date_from=payload.expense_date_from,
            expense_date_to=payload.expense_date_to,
            currency=payload.currency.upper(),
        )
        self.repo.add_report(report)
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.REPORT_CREATED,
                metadata={"employee_id": employee_id},
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def update_report(self, report_id: str, actor: UserSummary, payload: ExpenseReportUpdateIn) -> ExpenseReport:
        report = self._get_report_for_manager(report_id, actor.id)
        if report.status not in {ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CORRECTION}:
            raise ValueError("Solo se pueden editar reportes en borrador o con corrección solicitada.")

        if payload.employee_id is not None:
            self._assert_manager_can_target_employee(actor, payload.employee_id)
            report.employee_id = payload.employee_id
        if payload.title is not None:
            report.title = payload.title
        if payload.description is not None:
            report.description = payload.description
        if payload.report_type is not None:
            report.report_type = ExpenseReportType(payload.report_type)
        if payload.team_id is not None:
            report.team_id = payload.team_id
        if payload.vacation_request_id is not None:
            report.vacation_request_id = payload.vacation_request_id
        if payload.expense_date_from is not None:
            report.expense_date_from = payload.expense_date_from
        if payload.expense_date_to is not None:
            report.expense_date_to = payload.expense_date_to
        if payload.currency is not None:
            report.currency = payload.currency.upper()

        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.FIELDS_EDITED,
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def submit_report(self, report_id: str, actor: UserSummary) -> ExpenseReport:
        report = self._get_report_for_manager(report_id, actor.id)
        previous_status = report.status
        if previous_status not in {ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CORRECTION}:
            raise ValueError("El reporte no está en un estado enviable.")
        report.status = ExpenseReportStatus.SUBMITTED
        report.submitted_at = datetime.now(timezone.utc)
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.RESUBMITTED if previous_status == ExpenseReportStatus.NEEDS_CORRECTION else ExpenseActionType.SUBMITTED,
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def approve_report(self, report_id: str, actor: UserSummary, payload: ExpenseReportDecisionIn) -> ExpenseReport:
        report = self._get_report(report_id)
        if report.status not in {ExpenseReportStatus.SUBMITTED, ExpenseReportStatus.IN_REVIEW}:
            raise ValueError("El reporte no puede aprobarse en su estado actual.")
        report.status = ExpenseReportStatus.APPROVED
        report.reviewed_at = datetime.now(timezone.utc)
        report.reviewed_by = actor.id
        report.finance_comment = payload.comment
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.APPROVED,
                comment=payload.comment,
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def reject_report(self, report_id: str, actor: UserSummary, payload: ExpenseReportDecisionIn) -> ExpenseReport:
        report = self._get_report(report_id)
        if report.status not in {ExpenseReportStatus.SUBMITTED, ExpenseReportStatus.IN_REVIEW}:
            raise ValueError("El reporte no puede rechazarse en su estado actual.")
        report.status = ExpenseReportStatus.REJECTED
        report.reviewed_at = datetime.now(timezone.utc)
        report.reviewed_by = actor.id
        report.finance_comment = payload.comment
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.REJECTED,
                comment=payload.comment,
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    def request_correction(self, report_id: str, actor: UserSummary, payload: ExpenseReportDecisionIn) -> ExpenseReport:
        report = self._get_report(report_id)
        if report.status not in {ExpenseReportStatus.SUBMITTED, ExpenseReportStatus.IN_REVIEW}:
            raise ValueError("El reporte no admite solicitud de corrección en su estado actual.")
        report.status = ExpenseReportStatus.NEEDS_CORRECTION
        report.reviewed_at = datetime.now(timezone.utc)
        report.reviewed_by = actor.id
        report.finance_comment = payload.comment
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.CORRECTION_REQUESTED,
                comment=payload.comment,
            )
        )
        self.db.commit()
        self.db.refresh(report)
        return report

    async def upload_receipt(self, report_id: str, actor: UserSummary, upload_file, document_type: str = "INVOICE") -> ExpenseReceipt:
        report = self._get_report_for_manager(report_id, actor.id)
        if report.status not in {ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CORRECTION, ExpenseReportStatus.PROCESSING}:
            raise ValueError("No se pueden adjuntar comprobantes en el estado actual del reporte.")

        saved = await self.file_service.save(upload_file)
        receipt = ExpenseReceipt(
            expense_report_id=report.id,
            uploaded_by=actor.id,
            original_filename=saved["original_filename"],
            stored_filename=saved["stored_filename"],
            storage_path=saved["storage_path"],
            mime_type=saved["mime_type"],
            file_size=saved["file_size"],
            checksum=saved["checksum"],
            document_type=ExpenseDocumentType(document_type),
            ocr_status=ExpenseReceiptStatus.UPLOADED,
        )
        self.repo.add_receipt(receipt)
        report.status = ExpenseReportStatus.PROCESSING
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                expense_receipt_id=receipt.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.RECEIPT_UPLOADED,
                metadata={"filename": receipt.original_filename},
            )
        )
        if settings.expense_auto_analyze:
            self._analyze_receipt_internal(receipt)
            self._recalculate_report_totals(report.id)
            report.status = ExpenseReportStatus.DRAFT if report.status == ExpenseReportStatus.PROCESSING else report.status
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def analyze_receipt(self, receipt_id: str, actor: UserSummary) -> ExpenseReceipt:
        receipt = self.repo.get_receipt(receipt_id)
        if not receipt:
            raise ValueError("Comprobante no encontrado.")
        report = self._get_report_for_manager(str(receipt.expense_report_id), actor.id)
        self._analyze_receipt_internal(receipt)
        self._recalculate_report_totals(report.id)
        if report.status == ExpenseReportStatus.PROCESSING:
            report.status = ExpenseReportStatus.DRAFT
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def create_manual_receipt(self, report_id: str, actor: UserSummary, payload: ExpenseReceiptManualCreateIn) -> ExpenseReceipt:
        report = self._get_report_for_manager(report_id, actor.id)
        if report.status not in {ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CORRECTION, ExpenseReportStatus.PROCESSING}:
            raise ValueError("No se pueden agregar gastos manuales en el estado actual del reporte.")

        receipt = ExpenseReceipt(
            expense_report_id=report.id,
            uploaded_by=actor.id,
            category_id=payload.category_id,
            original_filename="manual-entry",
            stored_filename="manual-entry",
            storage_path="manual-entry",
            mime_type="application/manual",
            file_size=0,
            document_type=ExpenseDocumentType(payload.document_type),
            ocr_status=ExpenseReceiptStatus.REVIEW_REQUIRED,
            invoice_date=payload.invoice_date,
            issuer_rfc=payload.issuer_rfc,
            issuer_name=payload.issuer_name,
            folio=payload.folio,
            subtotal=payload.subtotal,
            iva=payload.iva,
            total=payload.total,
            currency=payload.currency.upper(),
            suggested_category=payload.suggested_category,
            sat_usage=payload.sat_usage,
            payment_method=payload.payment_method,
            payment_form=payload.payment_form,
            fiscal_uuid=payload.fiscal_uuid,
            is_validated=payload.is_validated,
            extracted_data={"source": "manual", "notes": payload.notes},
        )
        self.repo.add_receipt(receipt)
        self._recalculate_report_totals(report.id)
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                expense_receipt_id=receipt.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.RECEIPT_UPLOADED,
                metadata={"source": "manual", "notes": payload.notes},
            )
        )
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def update_receipt(self, receipt_id: str, actor: UserSummary, payload: ExpenseReceiptUpdateIn) -> ExpenseReceipt:
        receipt = self.repo.get_receipt(receipt_id)
        if not receipt:
            raise ValueError("Comprobante no encontrado.")
        report = self._get_report_for_manager(str(receipt.expense_report_id), actor.id)
        if report.status not in {ExpenseReportStatus.DRAFT, ExpenseReportStatus.NEEDS_CORRECTION, ExpenseReportStatus.PROCESSING}:
            raise ValueError("No puedes editar comprobantes en el estado actual del reporte.")

        for field in [
            "category_id", "invoice_date", "issuer_rfc", "issuer_name", "folio", "subtotal", "iva", "total",
            "currency", "suggested_category", "sat_usage", "payment_method", "payment_form", "fiscal_uuid", "is_validated"
        ]:
            value = getattr(payload, field)
            if value is not None:
                setattr(receipt, field, value)

        self.db.flush()
        self._recalculate_report_totals(report.id)
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=report.id,
                expense_receipt_id=receipt.id,
                actor_id=actor.id,
                actor_role=actor.role,
                action_type=ExpenseActionType.FIELDS_EDITED,
            )
        )
        self.db.commit()
        self.db.refresh(receipt)
        return receipt

    def _analyze_receipt_internal(self, receipt: ExpenseReceipt) -> None:
        raw_text = self.file_service.read_text_preview(receipt.storage_path)
        data = self.ocr_service.analyze(storage_path=receipt.storage_path, mime_type=receipt.mime_type, raw_text=raw_text)
        receipt.ocr_provider = data.get("ocr_provider")
        receipt.ocr_status = ExpenseReceiptStatus(data.get("ocr_status", "REVIEW_REQUIRED"))
        receipt.ocr_raw_text = data.get("raw_text")
        receipt.extracted_data = data
        receipt.ai_confidence = data.get("confidence")
        receipt.invoice_date = self._safe_date(data.get("invoice_date"))
        receipt.issuer_rfc = data.get("issuer_rfc")
        receipt.issuer_name = data.get("issuer_name")
        receipt.folio = data.get("folio")
        receipt.subtotal = data.get("subtotal", 0)
        receipt.iva = data.get("iva", 0)
        receipt.total = data.get("total", 0)
        receipt.currency = (data.get("currency") or receipt.currency or "MXN").upper()
        receipt.suggested_category = data.get("suggested_category")
        receipt.sat_usage = data.get("sat_usage")
        receipt.payment_method = data.get("payment_method")
        receipt.payment_form = data.get("payment_form")
        receipt.fiscal_uuid = data.get("fiscal_uuid")
        self.db.flush()
        self.repo.add_action(
            ExpenseAction(
                expense_report_id=receipt.expense_report_id,
                expense_receipt_id=receipt.id,
                actor_id=receipt.uploaded_by,
                actor_role="MANAGER",
                action_type=ExpenseActionType.OCR_COMPLETED,
                metadata={"confidence": data.get("confidence")},
            )
        )

    def _recalculate_report_totals(self, report_id) -> None:
        report = self._get_report(str(report_id))
        receipts = self.repo.list_receipts(str(report.id))
        report.subtotal = sum((item.subtotal or 0) for item in receipts)
        report.tax_total = sum((item.iva or 0) for item in receipts)
        report.total = sum((item.total or 0) for item in receipts)
        self.db.flush()

    def _safe_date(self, value: str | None):
        if not value:
            return None
        try:
            from datetime import date
            cleaned = value.replace('/', '-')
            parts = cleaned.split('-')
            if len(parts[0]) == 4:
                return date.fromisoformat(cleaned)
            if len(parts) == 3:
                return date(int(parts[2]), int(parts[1]), int(parts[0]))
        except Exception:
            return None
        return None

    def _get_report(self, report_id: str) -> ExpenseReport:
        report = self.repo.get_report(report_id)
        if not report:
            raise ValueError("Reporte de gastos no encontrado.")
        return report

    def _get_report_for_manager(self, report_id: str, manager_id: str) -> ExpenseReport:
        report = self._get_report(report_id)
        if str(report.manager_id) != str(manager_id):
            raise PermissionError("No tienes acceso a este reporte.")
        return report

    def _assert_manager_can_target_employee(self, actor: UserSummary, employee_id: str | None) -> None:
        if not employee_id:
            return
        if str(employee_id) == str(actor.id):
            return
        if actor.role == "ADMIN":
            return
        if not self.user_repo.is_manager_of(actor.id, employee_id):
            raise PermissionError("Solo puedes crear reportes para ti o para miembros de tu equipo.")
