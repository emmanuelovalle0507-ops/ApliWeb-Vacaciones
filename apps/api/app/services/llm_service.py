from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import error, request

from app.core.config import settings


@dataclass
class LLMResult:
    text: str


class LLMService:
    def __init__(self) -> None:
        self.enabled = bool(settings.llm_enabled and settings.openai_api_key)

    def _chat(self, messages: list[dict], temperature: float = 0.2) -> LLMResult | None:
        if not self.enabled:
            return None

        payload = {
            "model": settings.openai_model,
            "messages": messages,
            "temperature": temperature,
        }
        body = json.dumps(payload).encode("utf-8")

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
        except (error.URLError, error.HTTPError, TimeoutError):
            return None

        choices = data.get("choices", [])
        if not choices:
            return None
        message = choices[0].get("message", {})
        content = message.get("content")
        if not content:
            return None

        return LLMResult(text=str(content).strip())

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
        result = self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
        )
        if not result:
            return None
        return result.text

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
