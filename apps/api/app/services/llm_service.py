from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from urllib import error, request

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 1.0  # seconds


@dataclass
class LLMResult:
    text: str


class LLMService:
    def __init__(self) -> None:
        self.enabled = bool(settings.llm_enabled and settings.openai_api_key)

    def _chat(self, messages: list[dict], temperature: float = 0.2, retries: int = MAX_RETRIES) -> LLMResult | None:
        if not self.enabled:
            return None

        payload = {
            "model": settings.openai_model,
            "messages": messages,
            "temperature": temperature,
        }
        body = json.dumps(payload).encode("utf-8")

        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            req = request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                method="POST",
            )
            try:
                with request.urlopen(req, timeout=settings.openai_timeout_seconds) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                choices = data.get("choices", [])
                if not choices:
                    logger.warning("LLM returned empty choices (attempt %d/%d)", attempt, retries)
                    last_error = ValueError("Empty choices")
                    continue

                message = choices[0].get("message", {})
                content = message.get("content")
                if not content:
                    logger.warning("LLM returned empty content (attempt %d/%d)", attempt, retries)
                    last_error = ValueError("Empty content")
                    continue

                return LLMResult(text=str(content).strip())

            except error.HTTPError as exc:
                logger.warning("LLM HTTP error %s (attempt %d/%d)", exc.code, attempt, retries)
                last_error = exc
                if exc.code == 429 or exc.code >= 500:
                    time.sleep(RETRY_DELAY * attempt)
                    continue
                break
            except (error.URLError, TimeoutError, OSError) as exc:
                logger.warning("LLM connection error: %s (attempt %d/%d)", exc, attempt, retries)
                last_error = exc
                time.sleep(RETRY_DELAY * attempt)
                continue

        logger.error("LLM failed after %d attempts: %s", retries, last_error)
        return None

    def chat_with_role(self, system_prompt: str, user_message: str, temperature: float = 0.15) -> str | None:
        result = self._chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            temperature=temperature,
        )
        return result.text if result else None

    def _chat_vision(
        self,
        system_prompt: str,
        image_base64: str,
        media_type: str = "image/jpeg",
        temperature: float = 0.0,
        retries: int = MAX_RETRIES,
    ) -> LLMResult | None:
        """Call OpenAI with a vision-capable model (image as base64)."""
        if not self.enabled:
            return None

        user_content = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{media_type};base64,{image_base64}",
                    "detail": "high",
                },
            },
            {
                "type": "text",
                "text": "Analiza esta imagen de ticket/factura y extrae los datos.",
            },
        ]

        payload = {
            "model": settings.openai_vision_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "temperature": temperature,
            "max_tokens": 4000,
        }
        body = json.dumps(payload).encode("utf-8")

        last_error: Exception | None = None
        for attempt in range(1, retries + 1):
            req = request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.openai_api_key}",
                },
                method="POST",
            )
            try:
                with request.urlopen(req, timeout=60) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if not choices:
                    last_error = ValueError("Empty choices")
                    continue
                content = choices[0].get("message", {}).get("content")
                if not content:
                    last_error = ValueError("Empty content")
                    continue
                return LLMResult(text=str(content).strip())
            except error.HTTPError as exc:
                err_body = exc.read().decode("utf-8", errors="replace")[:500] if exc.fp else ""
                logger.warning("Vision HTTP error %s (attempt %d/%d): %s", exc.code, attempt, retries, err_body)
                last_error = exc
                if exc.code == 429 or exc.code >= 500:
                    time.sleep(RETRY_DELAY * attempt)
                    continue
                break
            except (error.URLError, TimeoutError, OSError) as exc:
                logger.warning("Vision connection error: %s (attempt %d/%d)", exc, attempt, retries)
                last_error = exc
                time.sleep(RETRY_DELAY * attempt)
                continue

        logger.error("Vision LLM failed after %d attempts: %s", retries, last_error)
        return None

    def extract_receipt(self, image_base64: str, media_type: str = "image/jpeg") -> dict | None:
        """Extract ALL visible data from a receipt/ticket/factura image using GPT-4o vision."""
        system = (
            "Eres un extractor exhaustivo de datos de tickets, recibos y facturas mexicanas. "
            "Tu objetivo es extraer TODA la información visible, no solo un resumen.\n\n"
            "Devuelve SOLO JSON válido con esta estructura:\n"
            "{\n"
            '  "vendor_name": "nombre del comercio/proveedor",\n'
            '  "vendor_address": "dirección del comercio si aparece",\n'
            '  "vendor_phone": "teléfono si aparece",\n'
            '  "receipt_date": "YYYY-MM-DD",\n'
            '  "receipt_time": "HH:MM si aparece",\n'
            '  "receipt_number": "número de ticket/folio si aparece",\n'
            '  "total_amount": 123.45,\n'
            '  "subtotal": 105.56,\n'
            '  "currency": "MXN",\n'
            '  "tax_amount": 17.89,\n'
            '  "tip_amount": null,\n'
            '  "discount_amount": null,\n'
            '  "payment_method": "CASH|CARD|TRANSFER|UNKNOWN",\n'
            '  "card_last_four": "1234 si pagó con tarjeta",\n'
            '  "category": "GASOLINE|TOLLS|FOOD|HOTEL|TRANSPORT|PARKING|SUPPLIES|OTHER",\n'
            '  "description": "descripción corta del gasto",\n'
            '  "line_items": [\n'
            '    {\n'
            '      "description": "nombre/descripción del artículo o servicio",\n'
            '      "quantity": 2,\n'
            '      "unit_price": 52.78,\n'
            '      "amount": 105.56,\n'
            '      "unit": "pieza/litro/kg/servicio si se indica"\n'
            "    }\n"
            "  ],\n"
            '  "additional_info": {\n'
            '    "cualquier_otro_dato_visible": "valor"\n'
            "  },\n"
            '  "confidence": 0.85,\n'
            '  "raw_text": "texto completo detectado en la imagen",\n'
            '  "uuid_fiscal": "UUID del CFDI si es factura (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX)",\n'
            '  "rfc_emisor": "RFC del emisor/proveedor si aparece",\n'
            '  "rfc_receptor": "RFC del receptor/comprador si aparece",\n'
            '  "regimen_fiscal": "régimen fiscal del emisor si aparece",\n'
            '  "uso_cfdi": "uso del CFDI si aparece (ej: G03, P01)",\n'
            '  "metodo_pago": "PUE o PPD si aparece",\n'
            '  "forma_pago": "código de forma de pago SAT si aparece"\n'
            "}\n\n"
            "REGLAS IMPORTANTES:\n"
            "- Extrae CADA artículo/producto/servicio individual en line_items, no solo el total.\n"
            "- Si el ticket lista 3 productos, devuelve los 3 en line_items.\n"
            "- Si hay datos visibles que no encajan en los campos definidos, ponlos en additional_info.\n"
            "- Si un campo no es detectado, usa null. NO inventes datos.\n"
            "- Siempre incluye confidence (0.0 a 1.0).\n"
            "- Si es factura CFDI, extrae UUID fiscal, RFCs, régimen fiscal, uso CFDI.\n"
            "- Responde SOLO con el JSON, sin markdown ni texto extra."
        )
        result = self._chat_vision(system, image_base64, media_type, temperature=0.0)
        if not result:
            return None
        text = result.text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[-1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            logger.error("Vision returned invalid JSON: %s", text[:300])
            return None
        if not isinstance(parsed, dict):
            return None
        return parsed

    def answer_domain_question(self, question: str, scope: str, context: str, domain_hint: str) -> str | None:
        system = (
            "Eres un asistente de gestión de vacaciones para managers/admins. "
            "Responde SOLO sobre datos y reglas de la aplicación. "
            "Si la pregunta no es del dominio, responde exactamente con el mensaje de restricción recibido. "
            "No inventes datos fuera del contexto proporcionado."
        )
        user = (
            f"Mensaje de restricción: {domain_hint}\n"
            f"Alcance del usuario: {scope}\n"
            f"Contexto interno:\n{context}\n\n"
            f"Pregunta: {question}"
        )
        return self.chat_with_role(system, user, temperature=0.1)

    def propose_policy(self, instruction: str, current_policy: dict, employees: int) -> dict | None:
        system = (
            "Eres un asistente que convierte instrucciones de manager/admin en política de vacaciones por equipo. "
            "Devuelve SOLO JSON válido con keys: max_people_off_per_day (int), min_notice_days (int), "
            "confidence ('low'|'medium'|'high'), notes (array de strings)."
        )
        user = (
            f"Instrucción: {instruction}\n"
            f"Política actual: {json.dumps(current_policy, ensure_ascii=False)}\n"
            f"Empleados activos en equipo: {employees}\n"
            "Reglas: max_people_off_per_day > 0, min_notice_days >= 0."
        )
        result = self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.0,
        )
        if not result:
            return None

        try:
            parsed = json.loads(result.text)
        except json.JSONDecodeError:
            return None

        if not isinstance(parsed, dict):
            return None
        return parsed

    def onboarding_questions(self, team_name: str, employees: int) -> list[str] | None:
        system = (
            "Genera preguntas breves para onboarding de reglas de vacaciones para un manager. "
            "Devuelve SOLO JSON válido con key 'questions' (array de 3 a 5 preguntas en español)."
        )
        user = f"Team: {team_name}. Empleados activos: {employees}."
        result = self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.2,
        )
        if not result:
            return None

        try:
            parsed = json.loads(result.text)
        except json.JSONDecodeError:
            return None

        questions = parsed.get("questions") if isinstance(parsed, dict) else None
        if not isinstance(questions, list):
            return None

        cleaned = [q.strip() for q in questions if isinstance(q, str) and q.strip()]
        return cleaned or None
