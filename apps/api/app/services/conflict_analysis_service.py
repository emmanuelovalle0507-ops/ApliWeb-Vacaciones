"""
Service for analyzing team coverage conflicts when approving vacation requests.
Uses OpenAI (via LLMService) to generate intelligent risk assessment,
recommendations, and optimal date suggestions.
"""
import calendar
import json
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.holidays import is_holiday
from app.repositories.team_policy_repo import TeamPolicyRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_balance_repo import VacationBalanceRepository
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
Recibirás un listado de opciones con un score algorítmico ya calculado (0-100).

Tu tarea NO es re-calificar, sino EXPLICAR cada opción en lenguaje humano y listar pros/cons concretos.

REGLAS:
- Responde SOLO con JSON válido, sin markdown ni texto extra.
- NO cambies el score: úsalo para informar el tono de la explicación.
- Para cada opción, genera una explicación breve (1-2 oraciones) en español.
- Menciona datos concretos: % cobertura, nombres de compañeros fuera, días de descanso real, puentes.
- Si la opción tiene "puente antes" o "puente después", destácalo como ventaja.
- Si la opción excede política o tiene cobertura <50%, sé claro con la advertencia.

Formato JSON (respetar los índices tal cual te llegan):
{
  "suggestions": [
    {
      "index": 0,
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
        self.balance_repo = VacationBalanceRepository(db)
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
    def _is_non_working(d: date) -> bool:
        """True for weekends or Mexican holidays."""
        return d.weekday() >= 5 or is_holiday(d)

    @staticmethod
    def _add_months(d: date, months: int) -> date:
        """Add N months to a date, clamping day to the month's last valid day."""
        if months <= 0:
            return d
        total = d.month - 1 + months
        year = d.year + total // 12
        month = total % 12 + 1
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(d.day, last_day))

    @classmethod
    def _count_adjacent_free_days(cls, from_day: date, direction: int) -> int:
        """
        Count consecutive non-working days (weekend + holidays) starting from `from_day`
        and moving in `direction` (+1 forward, -1 backward). `from_day` itself is checked first.
        Max lookup = 7 days (limits a stray vacation chain from polluting the score).
        """
        count = 0
        cur = from_day
        while count < 7 and cls._is_non_working(cur):
            count += 1
            cur = cur + timedelta(days=direction)
        return count

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

    # Score weights (must sum to 100)
    _W_COVERAGE = 40
    _W_NOTICE = 20
    _W_BRIDGE = 20
    _W_HOLIDAY_ADJACENCY = 15
    _W_LOW_COLLEAGUES = 5

    @classmethod
    def _compute_score(
        cls,
        *,
        min_coverage_pct: float,
        notice_days: int,
        search_horizon_days: int,
        bridge_before: int,
        bridge_after: int,
        holidays_in_range: int,
        colleagues_off_count: int,
        team_size: int,
        exceeds_policy: bool,
    ) -> int:
        """
        Return a 0-100 score for a candidate window. Higher = better.
        Breakdown (sum = 100):
            40  coverage     → lineal con min_coverage_pct
            20  notice       → inverso al horizonte de búsqueda (fechas más próximas = mejor)
            20  bridges      → puntos por puente antes/después (sin pedir ese día extra)
            15  holidays adj → por festivos dentro del rango (más descanso real "gratis")
             5  low colleagues off → bonus si pocos compañeros fuera
        `exceeds_policy` aplica penalización fuerte (-50) después.
        """
        # Coverage (40)
        cov_score = (max(0.0, min(min_coverage_pct, 100.0)) / 100.0) * cls._W_COVERAGE

        # Notice (20): nearer is better. Cap at search horizon.
        horizon = max(search_horizon_days, 1)
        proximity = max(0.0, 1.0 - (notice_days / horizon))
        notice_score = proximity * cls._W_NOTICE

        # Bridges (20): up to 3 free days each side counts
        bridge_strength = min(bridge_before, 3) + min(bridge_after, 3)  # 0..6
        bridge_score = (bridge_strength / 6.0) * cls._W_BRIDGE

        # Holidays inside range (15): a full-scale bonus at 2 holidays in the window
        hol_score = min(holidays_in_range / 2.0, 1.0) * cls._W_HOLIDAY_ADJACENCY

        # Low colleagues off (5): fewer unique colleagues off = better
        if team_size > 1:
            low_score = max(0.0, 1.0 - (colleagues_off_count / (team_size - 1))) * cls._W_LOW_COLLEAGUES
        else:
            low_score = float(cls._W_LOW_COLLEAGUES)

        total = cov_score + notice_score + bridge_score + hol_score + low_score
        if exceeds_policy:
            total -= 50.0

        return max(0, min(100, round(total)))

    def suggest_optimal_dates(
        self,
        employee_id: str,
        desired_days: int,
        search_months: int = 3,
        *,
        prefer_bridges: bool = False,
        earliest_start_date: date | None = None,
        flexible_days: int = 0,
    ) -> dict:
        """
        Suggest date ranges with least conflicts for the employee.
        Respects team policy (min_notice_days, max_people_off_per_day) and balance.

        Params:
            desired_days: business days requested (1..30)
            search_months: months to scan forward (1..6), precise via relativedelta
            prefer_bridges: boost bridge candidates in final ordering
            earliest_start_date: user-imposed lower bound (>= policy earliest)
            flexible_days: if >0, also consider ranges of desired_days ± N (0..2)

        Returns dict with policy_info, suggestions list, balance_info, and ai_powered flag.
        Raises ValueError if balance insufficient for desired_days.
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
        current_year = today.year

        # ── Balance validation ───────────────────────────
        balance = self.balance_repo.get_by_user_year(employee_id, current_year)
        available_days = float(balance.available_days) if balance else 0.0

        # Use the minimum possible `desired` (after flexibility) for the validation.
        min_possible = max(1, desired_days - max(0, flexible_days))
        if available_days < min_possible:
            raise ValueError(
                f"No tienes suficientes días de vacaciones disponibles. "
                f"Dispones de {available_days:g} día(s) y solicitas {min_possible}."
            )

        # ── Team policy ──────────────────────────────────
        current_policy = self.policy_repo.get_active_for_date(team_id, today)
        min_notice = current_policy.min_notice_days if current_policy else 0
        max_off = current_policy.max_people_off_per_day if current_policy else 1

        # Earliest allowed start = today + min_notice_days
        policy_earliest = today + timedelta(days=max(1, min_notice))
        if earliest_start_date and earliest_start_date > policy_earliest:
            earliest_start = earliest_start_date
        else:
            earliest_start = policy_earliest

        # Precise horizon: exact N months forward (1..6)
        scan_end = self._add_months(today, max(1, min(search_months, 6)))
        search_horizon_days = (scan_end - today).days

        all_bdays = list(self._iter_business_days(earliest_start, scan_end))

        # Determine variant sizes (flexibility)
        variants = sorted({
            max(1, desired_days + delta)
            for delta in range(-max(0, flexible_days), max(0, flexible_days) + 1)
            if max(1, desired_days + delta) <= available_days
        })
        if not variants:
            variants = [desired_days]

        if len(all_bdays) < min(variants):
            return {
                "policy_info": {
                    "min_notice_days": min_notice,
                    "max_people_off_per_day": max_off,
                    "team_size": team_size,
                    "earliest_allowed_date": earliest_start.strftime("%Y-%m-%d"),
                    "search_horizon_days": search_horizon_days,
                },
                "balance_info": {
                    "available_days": available_days,
                    "requested_days": desired_days,
                    "flexible_days": flexible_days,
                },
                "suggestions": [],
                "ai_powered": False,
            }

        # Pre-compute occupancy + off-names per business day
        day_occupancy: dict[date, int] = {}
        day_off_names: dict[date, list[str]] = {}
        approved_in_range = self.request_repo.list_team_approved_in_range(
            team_id, earliest_start, scan_end
        )
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

        # Pre-fetch employee's active requests (avoid overlaps)
        existing_requests = self.request_repo.list_by_employee(employee_id)
        active_requests = [
            r for r in existing_requests
            if r.status.value in ("PENDING", "APPROVED")
        ]

        # Sliding window over each variant
        candidates: list[dict] = []
        for variant in variants:
            for i in range(len(all_bdays) - variant + 1):
                window = all_bdays[i: i + variant]
                start_d = window[0]
                end_d = window[-1]

                # Skip overlap with own active requests
                if any(r.start_date <= end_d and r.end_date >= start_d for r in active_requests):
                    continue

                # Per-day data
                daily_data = []
                holidays_in_calendar: list[date] = []
                # Count holidays landing within calendar range (inclusive)
                cal_cursor = start_d
                while cal_cursor <= end_d:
                    if is_holiday(cal_cursor) and cal_cursor.weekday() < 5:
                        holidays_in_calendar.append(cal_cursor)
                    cal_cursor += timedelta(days=1)

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

                # Unique colleagues off during window
                colleagues_off: set[str] = set()
                for dd in daily_data:
                    colleagues_off.update(dd["off_names"])

                # Bridges (bidirectional): count non-working days adjacent to the window
                bridge_before = self._count_adjacent_free_days(start_d - timedelta(days=1), -1)
                bridge_after = self._count_adjacent_free_days(end_d + timedelta(days=1), +1)
                has_bridge = bridge_before >= 1 or bridge_after >= 1

                # Real rest days = business days + bridges (weekends/holidays inside + adjacent)
                # Count weekends/holidays inside calendar span:
                inner_free = 0
                cal_cursor = start_d
                while cal_cursor <= end_d:
                    if self._is_non_working(cal_cursor):
                        inner_free += 1
                    cal_cursor += timedelta(days=1)
                real_rest_days = variant + inner_free + bridge_before + bridge_after

                notice_days = (start_d - today).days

                score = self._compute_score(
                    min_coverage_pct=min_cov,
                    notice_days=notice_days,
                    search_horizon_days=search_horizon_days,
                    bridge_before=bridge_before,
                    bridge_after=bridge_after,
                    holidays_in_range=len(holidays_in_calendar),
                    colleagues_off_count=len(colleagues_off),
                    team_size=team_size,
                    exceeds_policy=exceeds_any,
                )

                # Light boost when the user specifically prefers bridges
                if prefer_bridges and has_bridge:
                    score = min(100, score + 5)

                candidates.append({
                    "start_date": start_d.strftime("%Y-%m-%d"),
                    "end_date": end_d.strftime("%Y-%m-%d"),
                    "days": variant,
                    "min_coverage_pct": min_cov,
                    "max_coverage_pct": max_cov,
                    "avg_coverage_pct": avg_cov,
                    "exceeds_policy": exceeds_any,
                    "has_bridge": has_bridge,
                    "bridge_before": bridge_before,
                    "bridge_after": bridge_after,
                    "real_rest_days": real_rest_days,
                    "holidays_in_range": [h.strftime("%Y-%m-%d") for h in holidays_in_calendar],
                    "colleagues_off": sorted(colleagues_off),
                    "notice_days": notice_days,
                    "score": score,
                    "daily_detail": daily_data,
                })

        # Sort by score desc, then soonest start
        candidates.sort(key=lambda s: (-s["score"], s["notice_days"]))

        # Dedupe: keep at most 2 per ISO week (allows same-week alternatives)
        filtered: list[dict] = []
        week_counts: dict[str, int] = {}
        for c in candidates:
            c_start = date.fromisoformat(c["start_date"])
            wk_key = c_start.isocalendar()
            wk = f"{wk_key[0]}-W{wk_key[1]}"
            if week_counts.get(wk, 0) >= 2:
                continue
            week_counts[wk] = week_counts.get(wk, 0) + 1
            filtered.append(c)
            if len(filtered) >= 10:
                break

        top = filtered[:6]

        # ── LLM selective: only when ambiguity or policy exceptions ───
        ai_powered = False
        should_ask_llm = self._should_invoke_llm(top)
        if top and self.llm.enabled and should_ask_llm:
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
                    ai_map: dict[int, dict] = {}
                    for s in ai_result["suggestions"]:
                        if isinstance(s, dict) and "index" in s:
                            ai_map[s["index"]] = s

                    for idx, c in enumerate(top):
                        ai_data = ai_map.get(idx, {})
                        c["ai_explanation"] = ai_data.get("explanation", "")
                        c["ai_pros"] = ai_data.get("pros", [])
                        c["ai_cons"] = ai_data.get("cons", [])
                    ai_powered = True
            except Exception as exc:
                logger.warning("AI date suggestion failed: %s", exc)

        # Strip verbose per-day detail from response
        for c in top:
            c.pop("daily_detail", None)

        return {
            "policy_info": {
                "min_notice_days": min_notice,
                "max_people_off_per_day": max_off,
                "team_size": team_size,
                "earliest_allowed_date": earliest_start.strftime("%Y-%m-%d"),
                "search_horizon_days": search_horizon_days,
            },
            "balance_info": {
                "available_days": available_days,
                "requested_days": desired_days,
                "flexible_days": flexible_days,
            },
            "suggestions": top,
            "ai_powered": ai_powered,
        }

    @staticmethod
    def _should_invoke_llm(candidates: list[dict]) -> bool:
        """
        Skip the LLM when the top candidates are unambiguously good AND identical.
        Invoke when:
          - Any candidate exceeds policy (operator needs context)
          - Top 2 scores differ by <10 (close call, user benefits from explanation)
          - Top score < 70 (suboptimal — help the user understand tradeoffs)
        """
        if not candidates:
            return False
        if any(c.get("exceeds_policy") for c in candidates):
            return True
        top_score = candidates[0].get("score", 0)
        if top_score < 70:
            return True
        if len(candidates) >= 2:
            second = candidates[1].get("score", 0)
            if top_score - second < 10:
                return True
        return False

    def _ask_llm_suggest(
        self,
        candidates: list[dict],
        team_size: int,
        desired_days: int,
        employee_name: str,
        max_off: int,
        min_notice: int,
    ) -> dict | None:
        """Ask AI to analyze and explain date suggestion options. Score is provided, NOT computed by LLM."""
        if not self.llm.enabled:
            return None

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
                "score_algoritmico": c["score"],
                "cobertura_minima": f"{c['min_coverage_pct']}%",
                "cobertura_promedio": f"{c['avg_coverage_pct']}%",
                "excede_politica": c["exceeds_policy"],
                "puente_antes_dias": c["bridge_before"],
                "puente_despues_dias": c["bridge_after"],
                "dias_descanso_real": c["real_rest_days"],
                "festivos_en_rango": c["holidays_in_range"],
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
