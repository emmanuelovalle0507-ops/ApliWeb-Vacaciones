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
