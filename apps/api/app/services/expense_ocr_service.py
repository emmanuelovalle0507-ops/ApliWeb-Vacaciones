from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path

from app.core.config import settings
from app.services.llm_service import LLMService


class ExpenseOCRService:
    def __init__(self) -> None:
        self.enabled = settings.expense_ocr_enabled and bool(settings.openai_api_key)
        self.provider = settings.expense_ocr_provider
        self.model = settings.expense_ocr_model
        self.llm = LLMService()

    def analyze(self, *, storage_path: str, mime_type: str, raw_text: str | None = None) -> dict:
        text = raw_text or ""
        suffix = Path(storage_path).suffix.lower()
        fallback = self._fallback_extract(text)
        fallback["ocr_provider"] = self.provider if self.enabled else "disabled"
        fallback["ocr_status"] = "PROCESSED" if text else "REVIEW_REQUIRED"

        if not self.enabled or not text:
            return fallback

        system = (
            "Extrae datos de facturación/viáticos para México. "
            "Devuelve SOLO JSON válido con: invoice_date, issuer_rfc, issuer_name, folio, subtotal, iva, total, currency, "
            "suggested_category, sat_usage, payment_method, payment_form, fiscal_uuid, confidence, warnings."
        )
        user = (
            f"Archivo: {Path(storage_path).name}\n"
            f"Mime: {mime_type}\n"
            f"Extensión: {suffix}\n"
            f"Texto OCR/documento:\n{text[:12000]}"
        )
        parsed = self.llm.chat_with_role(system, user, temperature=0.0)
        if not parsed:
            return fallback
        try:
            data = json.loads(parsed)
            if not isinstance(data, dict):
                return fallback
        except json.JSONDecodeError:
            return fallback

        merged = {**fallback, **data}
        merged["ocr_provider"] = self.provider
        merged["ocr_status"] = "PROCESSED"
        return merged

    def _fallback_extract(self, text: str) -> dict:
        upper = text.upper()
        rfc_match = re.search(r"\b([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\b", upper)
        total_match = re.search(r"(?:TOTAL|IMPORTE)\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        subtotal_match = re.search(r"SUBTOTAL\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        iva_match = re.search(r"IVA\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        date_match = re.search(r"(20\d{2}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]20\d{2})", text)
        uuid_match = re.search(r"\b([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\b", upper)

        return {
            "invoice_date": date_match.group(1) if date_match else None,
            "issuer_rfc": rfc_match.group(1) if rfc_match else None,
            "issuer_name": None,
            "folio": None,
            "subtotal": self._to_number(subtotal_match.group(1)) if subtotal_match else Decimal("0.00"),
            "iva": self._to_number(iva_match.group(1)) if iva_match else Decimal("0.00"),
            "total": self._to_number(total_match.group(1)) if total_match else Decimal("0.00"),
            "currency": "MXN",
            "suggested_category": self._suggest_category(upper),
            "sat_usage": None,
            "payment_method": None,
            "payment_form": None,
            "fiscal_uuid": uuid_match.group(1) if uuid_match else None,
            "confidence": 0.35 if text else 0.0,
            "warnings": [] if text else ["No se pudo extraer texto automáticamente."],
            "raw_text": text[:12000] if text else None,
        }

    def _to_number(self, value: str | None) -> Decimal:
        if not value:
            return Decimal("0.00")
        normalized = value.replace(",", "")
        try:
            return Decimal(normalized)
        except Exception:
            return Decimal("0.00")

    def _suggest_category(self, text: str) -> str:
        if any(token in text for token in ["GASOLINA", "PEMEX", "COMBUSTIBLE"]):
            return "gasolina"
        if any(token in text for token in ["UBER", "DIDI", "TAXI", "TRANSPORTE"]):
            return "transporte"
        if any(token in text for token in ["HOTEL", "HOSPEDAJE"]):
            return "hospedaje"
        if any(token in text for token in ["RESTAURANT", "COMIDA", "ALIMENTO"]):
            return "comida"
        if any(token in text for token in ["CASETA", "PEAJE"]):
            return "casetas"
        if any(token in text for token in ["ESTACIONAMIENTO", "PARKING"]):
            return "estacionamiento"
        if any(token in text for token in ["AEROMEXICO", "VUELO", "BOARDING"]):
            return "vuelo"
        return "otros"
