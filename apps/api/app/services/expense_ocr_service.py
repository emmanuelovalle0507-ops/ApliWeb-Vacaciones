from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path
from typing import Any

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
        fallback = self._normalize_json(self._fallback_extract(text))
        fallback["ocr_provider"] = self.provider if self.enabled else "disabled"
        fallback["ocr_status"] = "PROCESSED" if text else "REVIEW_REQUIRED"

        if self.enabled and mime_type.startswith("image/"):
            system = (
                "Extrae datos de facturación/viáticos para México desde la imagen. "
                "Devuelve SOLO JSON válido con: invoice_date, issuer_rfc, issuer_name, folio, subtotal, iva, total, currency, suggested_category, sat_usage, payment_method, payment_form, fiscal_uuid, confidence, warnings."
            )
            user = "Lee el ticket o factura y extrae los campos fiscales y operativos mexicanos más útiles para facturación."
            parsed = self.llm.chat_with_image(system, user, storage_path, temperature=0.0)
            if parsed:
                try:
                    data = json.loads(parsed)
                    if isinstance(data, dict):
                        merged = {**fallback, **data}
                        merged["ocr_provider"] = self.provider
                        merged["ocr_status"] = "PROCESSED"
                        return self._normalize_json(merged)
                except json.JSONDecodeError:
                    pass

        if not self.enabled or not text:
            return fallback

        system = (
            "Extrae datos de facturación/viáticos para México. "
            "Devuelve SOLO JSON válido con: invoice_date, issuer_rfc, issuer_name, folio, subtotal, iva, total, currency, "
            "suggested_category, sat_usage, payment_method, payment_form, fiscal_uuid, confidence, warnings. "
            "Si es ticket para facturación mexicana, intenta extraer especialmente RFC, razón social, fecha, total, subtotal, IVA, forma de pago, método de pago y folio."
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
        total_match = re.search(r"(?:TOTAL|IMPORTE|TOTAL A PAGAR)\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        subtotal_match = re.search(r"SUBTOTAL\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        iva_match = re.search(r"(?:IVA|I\.V\.A\.)\s*[:$]?\s*([\d,]+\.\d{2})", upper)
        date_match = re.search(r"(20\d{2}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]20\d{2})", text)
        uuid_match = re.search(r"\b([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\b", upper)
        folio_match = re.search(r"(?:FOLIO|TICKET|FACTURA|SERIE)\s*[:#-]?\s*([A-Z0-9-]{3,})", upper)
        payment_form_match = re.search(r"(?:FORMA DE PAGO|FP)\s*[:#-]?\s*([A-Z0-9 ]{2,30})", upper)
        payment_method_match = re.search(r"(?:METODO DE PAGO|M[EÉ]TODO DE PAGO|MP)\s*[:#-]?\s*([A-Z0-9 ]{2,30})", upper)

        return {
            "invoice_date": date_match.group(1) if date_match else None,
            "issuer_rfc": rfc_match.group(1) if rfc_match else None,
            "issuer_name": self._extract_issuer_name(text),
            "folio": folio_match.group(1) if folio_match else None,
            "subtotal": self._to_number(subtotal_match.group(1)) if subtotal_match else Decimal("0.00"),
            "iva": self._to_number(iva_match.group(1)) if iva_match else Decimal("0.00"),
            "total": self._to_number(total_match.group(1)) if total_match else Decimal("0.00"),
            "currency": "MXN",
            "suggested_category": self._suggest_category(upper),
            "sat_usage": None,
            "payment_method": payment_method_match.group(1).strip() if payment_method_match else None,
            "payment_form": payment_form_match.group(1).strip() if payment_form_match else None,
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

    def _normalize_json(self, value: Any):
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, dict):
            return {k: self._normalize_json(v) for k, v in value.items()}
        if isinstance(value, list):
            return [self._normalize_json(v) for v in value]
        return value

    def _extract_issuer_name(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in lines[:8]:
            upper = line.upper()
            if any(token in upper for token in ["S.A.", "S DE RL", "SA DE CV", "RESTAURANT", "HOTEL", "GASOLINERA", "SERVICIO", "TIENDA"]):
                return line[:255]
        return lines[0][:255] if lines else None

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
