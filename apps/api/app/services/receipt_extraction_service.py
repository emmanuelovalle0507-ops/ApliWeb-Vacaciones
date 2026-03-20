"""Service that orchestrates receipt extraction via AI vision pipeline."""

from __future__ import annotations

import base64
import logging
from datetime import date, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.expense_receipt import ExtractionStatus, ExpenseCategory
from app.repositories.audit_repo import AuditRepository
from app.repositories.expense_receipt_repo import ExpenseReceiptRepository
from app.services.llm_service import LLMService
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

# Media types that can be sent directly to vision API
_VISION_MEDIA_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

# Valid categories from our enum
_VALID_CATEGORIES = {c.value for c in ExpenseCategory}
_VALID_PAYMENT_METHODS = {"CASH", "CARD", "TRANSFER", "UNKNOWN"}


class ReceiptExtractionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.receipt_repo = ExpenseReceiptRepository(db)
        self.audit_repo = AuditRepository(db)
        self.llm = LLMService()
        self.storage = StorageService()

    def process_receipt(self, receipt_id: str) -> bool:
        """Process a single receipt: read file, call AI vision, persist results.

        Returns True if extraction succeeded, False otherwise.
        """
        receipt = self.receipt_repo.get_by_id(receipt_id)
        if not receipt:
            logger.error("Receipt %s not found", receipt_id)
            return False

        # Mark as processing
        receipt.extraction_status = ExtractionStatus.PROCESSING
        self.db.flush()

        try:
            # 1. Read file bytes
            file_path = self.storage.get_full_path(receipt.file_url)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            file_bytes = file_path.read_bytes()
            media_type = receipt.file_content_type

            # 2. Handle PDFs: for now we send as-is if the model supports it,
            #    but GPT-4o vision requires images. Convert first page if PDF.
            if media_type == "application/pdf":
                image_b64, media_type = self._pdf_to_image_base64(file_bytes)
            else:
                image_b64 = base64.b64encode(file_bytes).decode("utf-8")

            # 3. Call AI extraction
            result = self.llm.extract_receipt(image_b64, media_type)

            if not result:
                # AI unavailable or failed
                receipt.extraction_status = ExtractionStatus.FAILED
                receipt.extraction_json = {"error": "AI extraction returned no result"}
                self.db.flush()
                logger.warning("AI extraction failed for receipt %s (no result)", receipt_id)
                return False

            # 4. Persist raw extraction
            receipt.extraction_json = result
            receipt.ocr_text = result.get("raw_text")
            receipt.extraction_confidence = self._safe_float(result.get("confidence"))

            # 5. Normalize and persist fields
            receipt.vendor_name = self._safe_str(result.get("vendor_name"), 200)
            receipt.receipt_date = self._safe_date(result.get("receipt_date"))
            receipt.total_amount = self._safe_float(result.get("total_amount"))
            receipt.currency = self._safe_str(result.get("currency"), 3) or "MXN"
            receipt.tax_amount = self._safe_float(result.get("tax_amount"))
            receipt.payment_method = (
                result.get("payment_method")
                if result.get("payment_method") in _VALID_PAYMENT_METHODS
                else None
            )
            raw_category = result.get("category")
            if raw_category and raw_category in _VALID_CATEGORIES:
                receipt.category = ExpenseCategory(raw_category)
            receipt.description = self._safe_str(result.get("description"), 500)

            # If AI detected CFDI fields, populate them
            ai_uuid = self._safe_str(result.get("uuid_fiscal"), 36)
            ai_rfc_emisor = self._safe_str(result.get("rfc_emisor"), 13)
            ai_rfc_receptor = self._safe_str(result.get("rfc_receptor"), 13)
            if ai_uuid and len(ai_uuid) >= 32:
                receipt.is_cfdi = True
                receipt.uuid_fiscal = ai_uuid.upper()
                receipt.rfc_emisor = ai_rfc_emisor.upper() if ai_rfc_emisor else None
                receipt.rfc_receptor = ai_rfc_receptor.upper() if ai_rfc_receptor else None

            receipt.extraction_status = ExtractionStatus.DONE
            self.db.flush()

            # 6. Audit
            self.audit_repo.log(
                actor_user_id=receipt.owner_id,
                action="RECEIPT_EXTRACTED",
                entity_type="expense_receipt",
                entity_id=receipt_id,
                metadata={
                    "vendor": receipt.vendor_name,
                    "total": float(receipt.total_amount) if receipt.total_amount else None,
                    "confidence": float(receipt.extraction_confidence) if receipt.extraction_confidence else None,
                },
            )

            logger.info(
                "Receipt %s extracted OK: vendor=%s total=%s confidence=%s",
                receipt_id,
                receipt.vendor_name,
                receipt.total_amount,
                receipt.extraction_confidence,
            )
            return True

        except Exception as exc:
            logger.exception("Receipt extraction failed for %s: %s", receipt_id, exc)
            receipt.extraction_status = ExtractionStatus.FAILED
            receipt.extraction_json = {"error": str(exc)}
            self.db.flush()
            return False

    def _pdf_to_image_base64(self, pdf_bytes: bytes) -> tuple[str, str]:
        """Convert first page of PDF to JPEG base64.

        Uses a lightweight approach: if pdf2image/Pillow are available, use them.
        Otherwise, send the PDF bytes directly and let the model attempt to handle it.
        """
        try:
            from pdf2image import convert_from_bytes
            images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=200)
            if images:
                import io
                buf = io.BytesIO()
                images[0].save(buf, format="JPEG", quality=90)
                return base64.b64encode(buf.getvalue()).decode("utf-8"), "image/jpeg"
        except ImportError:
            logger.warning("pdf2image not installed — sending PDF as base64 directly")
        except Exception as exc:
            logger.warning("PDF conversion failed: %s — sending raw", exc)

        # Fallback: send PDF bytes as base64 with generic type
        return base64.b64encode(pdf_bytes).decode("utf-8"), "application/pdf"

    @staticmethod
    def _safe_str(val, max_len: int = 500) -> str | None:
        if val is None:
            return None
        s = str(val).strip()
        return s[:max_len] if s else None

    @staticmethod
    def _safe_float(val) -> float | None:
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _safe_date(val) -> date | None:
        if val is None:
            return None
        try:
            return datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None
