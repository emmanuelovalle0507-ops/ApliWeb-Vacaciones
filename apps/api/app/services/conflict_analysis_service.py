"""
Service for analyzing team coverage conflicts when approving vacation requests.
Uses OpenAI (via LLMService) to generate intelligent risk assessment,
recommendations, and optimal date suggestions.
"""
import json
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.holidays import is_holiday
from app.repositories.team_policy_repo import TeamPolicyRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.services.llm_service import LLMService
from app.services import jira_service

logger = logging.getLogger(__name__)  # AI-powered conflict analysis

_CONFLICT_SYSTEM_PROMPT = """\
Eres un analista experto en gestión de recursos humanos y planificación de equipos.
Tu tarea es analizar los datos de cobertura de un equipo cuando un empleado solicita vacaciones
y dar una recomendación clara al manager que debe aprobar o rechazar.

REGLAS:
- Responde SOLO con JSON válido, sin markdown ni texto extra.
- Analiza los datos proporcionados (cobertura diaria, personas fuera, política del equipo).
- Evalúa el impacto operativo real: ¿el equipo puede funcionar con esa cobertura?
- Considera patrones: ¿hay días consecutivos con baja cobertura? ¿es un periodo crítico?
- Si hay datos de Jira (tickets del empleado), analiza la carga de trabajo: ¿tiene tickets de alta prioridad? ¿vencen durante las vacaciones?
- Sé específico: menciona nombres, fechas, porcentajes concretos y tickets relevantes.

Formato de respuesta JSON:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "Resumen ejecutivo en 1-2 oraciones en español",
  "recommendation": "Recomendación detallada al manager en español (2-4 oraciones). Incluye razones concretas.",
  "key_concerns": ["lista de preocupaciones específicas si las hay"],
  "suggested_actions": ["acciones sugeridas para mitigar riesgos si aplica"],
  "jira_concerns": ["preocupaciones sobre tickets de Jira si aplica, vacío si no hay datos de Jira"]
}
"""

_SUGGEST_DATES_SYSTEM_PROMPT = """\
Eres un asesor experto en planificación de vacaciones para empleados.
Recibirás datos sobre las opciones de fechas disponibles para un empleado,
incluyendo la cobertura del equipo, política de la empresa, y ocupación real.

Tu tarea es analizar cada opción y generar una recomendación personalizada.

REGLAS:
- Responde SOLO con JSON válido, sin markdown ni texto extra.
- Para cada opción, genera una explicación clara y concisa en español de por qué es buena o mala.
- Considera: cobertura del equipo, si hay puentes (viernes+lunes = más descanso real),
  proximidad a días festivos, cuántos compañeros ya están fuera, y el cumplimiento de la política.
- Sé específico: menciona porcentajes, nombres de compañeros fuera, fechas concretas.
- Ordena las opciones de mejor a peor según impacto operativo.

Formato JSON:
{
  "suggestions": [
    {
      "index": 0,
      "score": 95,
      "explanation": "Explicación personalizada en español (1-2 oraciones)",
      "pros": ["ventaja 1", "ventaja 2"],
      "cons": ["desventaja 1"]
    }
  ]
}
"""


class ConflictAnalysisService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.request_repo = VacationRequestRepository(db)
        self.user_repo = UserRepository(db)
        self.policy_repo = TeamPolicyRepository(db)
        self.llm = LLMService()

    # ── helpers ──────────────────────────────────────────

    @staticmethod
    def _iter_business_days(start_date: date, end_date: date):
        current = start_date
        while current <= end_date:
            if current.weekday() < 5 and not is_holiday(current):
                yield current
            current += timedelta(days=1)

    @staticmethod
    def _safe_parse_json(text: str | None) -> dict | None:
        if not text:
            return None
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        try:
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            logger.warning("LLM returned invalid JSON for conflict analysis: %s", cleaned[:300])
            return None

    # ── main analysis ────────────────────────────────────

    def analyze_conflict(self, request_id: str) -> dict:
        """
        Analyze a vacation request and return an AI-powered conflict report.
        Gathers team data, then sends it to OpenAI for intelligent analysis.
        Falls back to algorithmic analysis if LLM is unavailable.
        """
        # ── 1. Gather data ───────────────────────────────
        request = self.request_repo.get_by_id(request_id)
        if not request:
            raise ValueError("Solicitud no encontrada.")

        team_id = str(request.team_id)
        start = request.start_date
        end = request.end_date

        team_members = self.user_repo.list_all(team_id=team_id)
        team_size = len(team_members)
        if team_size == 0:
            raise ValueError("El equipo no tiene miembros registrados.")

        requester = self.user_repo.get_by_id(str(request.employee_id))
        requester_name = requester.full_name if requester else "Empleado"
        requester_email = requester.email if requester else None
        bdays_requested = sum(1 for _ in self._iter_business_days(start, end))

        # ── 1b. Jira data ──────────────────────────────────
        jira_data = None
        if requester_email:
            try:
                jira_data = jira_service.get_employee_issues(requester_email, start, end)
            except Exception as exc:
                logger.warning("Jira query failed for %s: %s", requester_email, exc)

        # Overlapping approved requests (exclude self)
        overlapping = self.request_repo.list_team_approved_in_range(team_id, start, end)
        overlapping = [r for r in overlapping if str(r.id) != request_id]

        # Employee name cache
        emp_names: dict[str, str] = {}
        for r in overlapping:
            eid = str(r.employee_id)
            if eid not in emp_names:
                u = self.user_repo.get_by_id(eid)
                emp_names[eid] = u.full_name if u else "Desconocido"

        # ── 2. Daily analysis ────────────────────────────
        daily_analysis = []
        worst_day = None

        for day in self._iter_business_days(start, end):
            policy = self.policy_repo.get_active_for_date(team_id, day)
            max_off = policy.max_people_off_per_day if policy else 1

            off_names = []
            for r in overlapping:
                r_start = r.start_date
                r_end = r.end_date
                if r_start <= day <= r_end and day.weekday() < 5:
                    off_names.append(emp_names.get(str(r.employee_id), "Desconocido"))

            occupied = len(off_names)
            occupied_if_approved = occupied + 1
            available_slots = max(0, max_off - occupied_if_approved)
            coverage_pct = round(((team_size - occupied_if_approved) / team_size) * 100, 1)

            day_info = {
                "date": day.strftime("%Y-%m-%d"),
                "date_label": day.strftime("%d/%m/%Y"),
                "occupied_current": occupied,
                "occupied_if_approved": occupied_if_approved,
                "off_names": off_names,
                "max_allowed_off": max_off,
                "available_slots": available_slots,
                "coverage_pct": max(0, coverage_pct),
                "exceeds_policy": occupied_if_approved > max_off,
            }
            daily_analysis.append(day_info)

            if worst_day is None or coverage_pct < worst_day["coverage_pct"]:
                worst_day = day_info

        # Overlap summary (deduplicated by employee)
        overlap_summary = []
        seen_employees: set[str] = set()
        for r in overlapping:
            eid = str(r.employee_id)
            if eid in seen_employees:
                continue
            seen_employees.add(eid)
            bdays = sum(1 for _ in self._iter_business_days(r.start_date, r.end_date))
            overlap_summary.append({
                "employee_name": emp_names.get(eid, "Desconocido"),
                "start_date": r.start_date.strftime("%Y-%m-%d"),
                "end_date": r.end_date.strftime("%Y-%m-%d"),
                "days": bdays,
            })

        # ── 3. Algorithmic risk (baseline) ───────────────
        exceeds_count = sum(1 for d in daily_analysis if d["exceeds_policy"])
        min_coverage = min((d["coverage_pct"] for d in daily_analysis), default=100)

        if exceeds_count > 0:
            algo_risk = "CRITICAL"
        elif min_coverage < 50:
            algo_risk = "HIGH"
        elif min_coverage < 70:
            algo_risk = "MEDIUM"
        else:
            algo_risk = "LOW"

        # ── 4. AI Analysis (OpenAI) ──────────────────────
        ai_recommendation = None
        risk_level = algo_risk
        summary = self._fallback_summary(algo_risk, requester_name, bdays_requested, exceeds_count, min_coverage, len(overlap_summary))

        try:
            ai_result = self._ask_llm_analysis(
                requester_name=requester_name,
                days_requested=bdays_requested,
                start_date=start.strftime("%Y-%m-%d"),
                end_date=end.strftime("%Y-%m-%d"),
                team_size=team_size,
                daily_analysis=daily_analysis,
                overlap_summary=overlap_summary,
                algo_risk=algo_risk,
                min_coverage=min_coverage,
                exceeds_count=exceeds_count,
                jira_data=jira_data,
            )
            if ai_result:
                risk_level = ai_result.get("risk_level", algo_risk)
                if risk_level not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
                    risk_level = algo_risk
                summary = ai_result.get("summary", summary)
                ai_recommendation = {
                    "recommendation": ai_result.get("recommendation", ""),
                    "key_concerns": ai_result.get("key_concerns", []),
                    "suggested_actions": ai_result.get("suggested_actions", []),
                    "jira_concerns": ai_result.get("jira_concerns", []),
                }
        except Exception as exc:
            logger.warning("AI conflict analysis failed, using algorithmic fallback: %s", exc)

        return {
            "request_id": request_id,
            "requester_name": requester_name,
            "risk_level": risk_level,
            "team_size": team_size,
            "days_requested": bdays_requested,
            "daily_analysis": daily_analysis,
            "overlapping_requests": overlap_summary,
            "worst_day": worst_day,
            "summary": summary,
            "ai_recommendation": ai_recommendation,
            "ai_powered": ai_recommendation is not None,
            "jira": jira_data,
        }

    def _ask_llm_analysis(
        self,
        requester_name: str,
        days_requested: int,
        start_date: str,
        end_date: str,
        team_size: int,
        daily_analysis: list[dict],
        overlap_summary: list[dict],
        algo_risk: str,
        min_coverage: float,
        exceeds_count: int,
        jira_data: dict | None = None,
    ) -> dict | None:
        """Send team data to OpenAI and get an intelligent risk assessment."""
        if not self.llm.enabled:
            return None

        # Build a concise data payload for the LLM
        daily_compact = []
        for d in daily_analysis:
            daily_compact.append({
                "fecha": d["date_label"],
                "cobertura": f"{d['coverage_pct']}%",
                "fuera": d["occupied_if_approved"],
                "max_permitido": d["max_allowed_off"],
                "excede": d["exceeds_policy"],
                "personas_fuera": d["off_names"],
            })

        payload = {
            "solicitud": {
                "empleado": requester_name,
                "dias_solicitados": days_requested,
                "fecha_inicio": start_date,
                "fecha_fin": end_date,
            },
            "equipo": {
                "total_miembros": team_size,
                "cobertura_minima": f"{min_coverage}%",
                "dias_exceden_politica": exceeds_count,
                "riesgo_algoritmico": algo_risk,
            },
            "cobertura_diaria": daily_compact,
            "compañeros_en_vacaciones": overlap_summary,
        }

        if jira_data and jira_data.get("success") and jira_data.get("issues"):
            jira_compact = []
            for iss in jira_data["issues"]:
                jira_compact.append({
                    "ticket": iss["key"],
                    "titulo": iss["summary"],
                    "prioridad": iss["priority"],
                    "estado": iss["status"],
                    "fecha_vencimiento": iss.get("due_date") or "Sin fecha",
                    "sprint": iss.get("sprint") or "Sin sprint",
                    "proyecto": iss["project"],
                })
            payload["jira_tickets_empleado"] = {
                "total": jira_data["total"],
                "alta_prioridad": jira_data["high_priority_count"],
                "vencen_en_periodo": jira_data["due_during_period"],
                "tickets": jira_compact,
            }

        user_message = json.dumps(payload, ensure_ascii=False, indent=2)

        result_text = self.llm.chat_with_role(
            _CONFLICT_SYSTEM_PROMPT,
            user_message,
            temperature=0.1,
        )
        return self._safe_parse_json(result_text)

    @staticmethod
    def _fallback_summary(
        risk: str, name: str, days: int, exceeds: int, min_cov: float, overlaps: int
    ) -> str:
        """Algorithmic fallback summary when LLM is unavailable."""
        if risk == "CRITICAL":
            return (
                f"⚠️ CONFLICTO CRÍTICO: Aprobar la solicitud de {name} "
                f"({days} días) excedería el límite de ausencias "
                f"en {exceeds} día(s). Se recomienda rechazar o sugerir otras fechas."
            )
        if risk == "HIGH":
            return (
                f"🔴 Riesgo ALTO: La cobertura mínima del equipo sería del "
                f"{min_cov}% si se aprueba. Hay {overlaps} "
                f"compañero(s) de vacaciones en el mismo período."
            )
        if risk == "MEDIUM":
            return (
                f"🟡 Riesgo MEDIO: La cobertura del equipo bajaría al "
                f"{min_cov}%. Revisa que haya cobertura suficiente."
            )
        return (
            f"🟢 Sin conflictos significativos. Cobertura mínima del equipo: "
            f"{min_cov}%. Se puede aprobar sin problemas."
        )

    # ── date suggestions ─────────────────────────────────

    def suggest_optimal_dates(
        self,
        employee_id: str,
        desired_days: int,
        search_months: int = 3,
    ) -> dict:
        """
        Suggest date ranges with least conflicts for the employee.
        Respects team policy (min_notice_days, max_people_off_per_day).
        Uses AI to generate personalized explanations.
        Returns dict with policy_info, suggestions list, and ai_powered flag.
        """
        employee = self.user_repo.get_by_id(employee_id)
        if not employee or not employee.team_id:
            raise ValueError("Empleado o equipo no encontrado.")

        team_id = str(employee.team_id)
        team_members = self.user_repo.list_all(team_id=team_id)
        team_size = len(team_members)
        if team_size == 0:
            raise ValueError("El equipo no tiene miembros registrados.")

        employee_name = employee.full_name or "Empleado"

        today = date.today()

        # ── Get team policy to respect min_notice_days ───
        current_policy = self.policy_repo.get_active_for_date(team_id, today)
        min_notice = current_policy.min_notice_days if current_policy else 0
        max_off = current_policy.max_people_off_per_day if current_policy else 1

        # Earliest allowed start = today + min_notice_days (business days)
        earliest_start = today + timedelta(days=max(1, min_notice))
        scan_end = today + timedelta(days=search_months * 30)

        all_bdays = list(self._iter_business_days(earliest_start, scan_end))
        if len(all_bdays) < desired_days:
            return {
                "policy_info": {
                    "min_notice_days": min_notice,
                    "max_people_off_per_day": max_off,
                    "team_size": team_size,
                    "earliest_allowed_date": earliest_start.strftime("%Y-%m-%d"),
                },
                "suggestions": [],
                "ai_powered": False,
            }

        # Pre-compute occupancy + who is off for all scan days
        day_occupancy: dict[date, int] = {}
        day_off_names: dict[date, list[str]] = {}
        approved_in_range = self.request_repo.list_team_approved_in_range(
            team_id, earliest_start, scan_end
        )
        # Build name cache
        emp_name_cache: dict[str, str] = {}
        for r in approved_in_range:
            eid = str(r.employee_id)
            if eid not in emp_name_cache:
                u = self.user_repo.get_by_id(eid)
                emp_name_cache[eid] = u.full_name if u else "Desconocido"

        for d in all_bdays:
            off_names = []
            for r in approved_in_range:
                if r.start_date <= d <= r.end_date:
                    off_names.append(emp_name_cache.get(str(r.employee_id), "Desconocido"))
            day_occupancy[d] = len(off_names)
            day_off_names[d] = off_names

        # Pre-fetch employee's active requests
        existing_requests = self.request_repo.list_by_employee(employee_id)
        active_requests = [
            r for r in existing_requests
            if r.status.value in ("PENDING", "APPROVED")
        ]

        # Sliding window — build candidates with rich data
        candidates = []
        for i in range(len(all_bdays) - desired_days + 1):
            window = all_bdays[i: i + desired_days]
            start_d = window[0]
            end_d = window[-1]

            # Skip if employee already has overlapping request
            has_overlap = any(
                r.start_date <= end_d and r.end_date >= start_d
                for r in active_requests
            )
            if has_overlap:
                continue

            # Per-day analysis for this window
            daily_data = []
            for d in window:
                occ = day_occupancy.get(d, 0)
                occ_if_approved = occ + 1
                cov = round(((team_size - occ_if_approved) / team_size) * 100, 1)
                daily_data.append({
                    "date": d.strftime("%Y-%m-%d"),
                    "occupancy": occ_if_approved,
                    "coverage_pct": max(0, cov),
                    "off_names": day_off_names.get(d, []),
                    "exceeds": occ_if_approved > max_off,
                })

            coverages = [dd["coverage_pct"] for dd in daily_data]
            min_cov = min(coverages)
            max_cov = max(coverages)
            avg_cov = round(sum(coverages) / len(coverages), 1)
            exceeds_any = any(dd["exceeds"] for dd in daily_data)

            # Collect unique colleagues who are off during this window
            colleagues_off: set[str] = set()
            for dd in daily_data:
                colleagues_off.update(dd["off_names"])

            # Check if it contains a bridge (viernes + lunes)
            has_bridge = any(
                d.weekday() == 4 and (d + timedelta(days=3)) in window
                for d in window
            )

            # Notice days from today
            notice_days = (start_d - today).days

            candidates.append({
                "start_date": start_d.strftime("%Y-%m-%d"),
                "end_date": end_d.strftime("%Y-%m-%d"),
                "days": desired_days,
                "min_coverage_pct": min_cov,
                "max_coverage_pct": max_cov,
                "avg_coverage_pct": avg_cov,
                "exceeds_policy": exceeds_any,
                "has_bridge": has_bridge,
                "colleagues_off": sorted(colleagues_off),
                "notice_days": notice_days,
                "daily_detail": daily_data,
            })

        # Sort algorithmically:
        #   1) no exceeds first
        #   2) highest min coverage
        #   3) soonest dates (prefer near-term, not months ahead)
        #   4) bridges as tiebreaker bonus
        candidates.sort(key=lambda s: (
            s["exceeds_policy"],
            -s["min_coverage_pct"],
            s["notice_days"],
            -s["has_bridge"],
        ))

        # Deduplicate: remove windows that share the same start week
        filtered: list[dict] = []
        seen_weeks: set[str] = set()
        for c in candidates:
            c_start = date.fromisoformat(c["start_date"])
            week_key = c_start.isocalendar()[:2]
            wk = f"{week_key[0]}-W{week_key[1]}"
            if wk in seen_weeks:
                continue
            seen_weeks.add(wk)
            filtered.append(c)
            if len(filtered) >= 8:
                break

        top = filtered[:5]

        # ── Ask AI for personalized explanations ─────────
        ai_powered = False
        if top and self.llm.enabled:
            try:
                ai_result = self._ask_llm_suggest(
                    candidates=top,
                    team_size=team_size,
                    desired_days=desired_days,
                    employee_name=employee_name,
                    max_off=max_off,
                    min_notice=min_notice,
                )
                if ai_result and isinstance(ai_result.get("suggestions"), list):
                    ai_suggestions = ai_result["suggestions"]
                    # Map AI data back to candidates by index
                    ai_map: dict[int, dict] = {}
                    for s in ai_suggestions:
                        if isinstance(s, dict) and "index" in s:
                            ai_map[s["index"]] = s

                    enriched = []
                    for idx, c in enumerate(top):
                        entry = dict(c)
                        ai_data = ai_map.get(idx, {})
                        entry["ai_explanation"] = ai_data.get("explanation", "")
                        entry["ai_score"] = ai_data.get("score", 0)
                        entry["ai_pros"] = ai_data.get("pros", [])
                        entry["ai_cons"] = ai_data.get("cons", [])
                        enriched.append(entry)

                    # Re-sort by AI score if available
                    enriched.sort(key=lambda s: -(s.get("ai_score", 0)))
                    top = enriched
                    ai_powered = True
            except Exception as exc:
                logger.warning("AI date suggestion failed: %s", exc)

        # Remove daily_detail from response (too verbose for frontend)
        for c in top:
            c.pop("daily_detail", None)

        return {
            "policy_info": {
                "min_notice_days": min_notice,
                "max_people_off_per_day": max_off,
                "team_size": team_size,
                "earliest_allowed_date": earliest_start.strftime("%Y-%m-%d"),
            },
            "suggestions": top,
            "ai_powered": ai_powered,
        }

    def _ask_llm_suggest(
        self,
        candidates: list[dict],
        team_size: int,
        desired_days: int,
        employee_name: str,
        max_off: int,
        min_notice: int,
    ) -> dict | None:
        """Ask AI to analyze and explain date suggestion options."""
        if not self.llm.enabled:
            return None

        # Build rich context for the LLM
        options = []
        for i, c in enumerate(candidates):
            daily = c.get("daily_detail", [])
            day_summaries = []
            for dd in daily:
                names = dd.get("off_names", [])
                day_summaries.append({
                    "fecha": dd["date"],
                    "cobertura": f"{dd['coverage_pct']}%",
                    "personas_fuera": names if names else "nadie",
                })

            options.append({
                "indice": i,
                "inicio": c["start_date"],
                "fin": c["end_date"],
                "dias_habiles": c["days"],
                "cobertura_minima": f"{c['min_coverage_pct']}%",
                "cobertura_maxima": f"{c['max_coverage_pct']}%",
                "cobertura_promedio": f"{c['avg_coverage_pct']}%",
                "excede_politica": c["exceeds_policy"],
                "tiene_puente": c["has_bridge"],
                "compañeros_fuera": c["colleagues_off"],
                "dias_anticipacion": c["notice_days"],
                "detalle_diario": day_summaries,
            })

        user_message = json.dumps({
            "empleado": employee_name,
            "dias_solicitados": desired_days,
            "equipo": {
                "total_miembros": team_size,
                "max_personas_fuera_por_dia": max_off,
                "dias_anticipacion_minima": min_notice,
            },
            "opciones": options,
        }, ensure_ascii=False, indent=2)

        result_text = self.llm.chat_with_role(
            _SUGGEST_DATES_SYSTEM_PROMPT,
            user_message,
            temperature=0.15,
        )
        return self._safe_parse_json(result_text)
