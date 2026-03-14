from app.models.expense import ExpenseAction, ExpenseCategory, ExpenseReceipt, ExpenseReport
from app.schemas.expense import ExpenseActionOut, ExpenseCategoryOut, ExpenseReceiptOut, ExpenseReportOut


def expense_category_to_out(category: ExpenseCategory) -> ExpenseCategoryOut:
    return ExpenseCategoryOut(
        id=str(category.id),
        code=category.code,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
    )


def expense_receipt_to_out(receipt: ExpenseReceipt) -> ExpenseReceiptOut:
    return ExpenseReceiptOut(
        id=str(receipt.id),
        expense_report_id=str(receipt.expense_report_id),
        uploaded_by=str(receipt.uploaded_by),
        category_id=str(receipt.category_id) if receipt.category_id else None,
        original_filename=receipt.original_filename,
        stored_filename=receipt.stored_filename,
        storage_path=receipt.storage_path,
        mime_type=receipt.mime_type,
        file_size=receipt.file_size,
        checksum=receipt.checksum,
        document_type=receipt.document_type.value,
        ocr_status=receipt.ocr_status.value,
        ocr_provider=receipt.ocr_provider,
        ai_confidence=receipt.ai_confidence,
        invoice_date=receipt.invoice_date,
        issuer_rfc=receipt.issuer_rfc,
        issuer_name=receipt.issuer_name,
        folio=receipt.folio,
        subtotal=receipt.subtotal,
        iva=receipt.iva,
        total=receipt.total,
        currency=receipt.currency,
        suggested_category=receipt.suggested_category,
        sat_usage=receipt.sat_usage,
        payment_method=receipt.payment_method,
        payment_form=receipt.payment_form,
        fiscal_uuid=receipt.fiscal_uuid,
        is_validated=receipt.is_validated,
        extracted_data=receipt.extracted_data,
        created_at=receipt.created_at,
        updated_at=receipt.updated_at,
    )


def expense_action_to_out(action: ExpenseAction) -> ExpenseActionOut:
    return ExpenseActionOut(
        id=str(action.id),
        expense_report_id=str(action.expense_report_id),
        expense_receipt_id=str(action.expense_receipt_id) if action.expense_receipt_id else None,
        actor_id=str(action.actor_id),
        actor_role=action.actor_role,
        action_type=action.action_type.value,
        comment=action.comment,
        metadata=action.metadata,
        created_at=action.created_at,
    )


def expense_report_to_out(report: ExpenseReport, receipts: list[ExpenseReceipt] | None = None, actions: list[ExpenseAction] | None = None) -> ExpenseReportOut:
    return ExpenseReportOut(
        id=str(report.id),
        manager_id=str(report.manager_id),
        employee_id=str(report.employee_id) if report.employee_id else None,
        team_id=str(report.team_id) if report.team_id else None,
        vacation_request_id=str(report.vacation_request_id) if report.vacation_request_id else None,
        title=report.title,
        description=report.description,
        report_type=report.report_type.value,
        expense_date_from=report.expense_date_from,
        expense_date_to=report.expense_date_to,
        currency=report.currency,
        subtotal=report.subtotal,
        tax_total=report.tax_total,
        total=report.total,
        status=report.status.value,
        submitted_at=report.submitted_at,
        reviewed_at=report.reviewed_at,
        reviewed_by=str(report.reviewed_by) if report.reviewed_by else None,
        finance_comment=report.finance_comment,
        created_at=report.created_at,
        updated_at=report.updated_at,
        receipts=[expense_receipt_to_out(item) for item in (receipts or [])],
        actions=[expense_action_to_out(item) for item in (actions or [])],
    )
