"""
Service for analyzing team coverage conflicts when approving vacation requests.
Provides risk assessment, overlap detection, and optimal date suggestions.
"""
from datetime import date, timedelta
from collections import defaultdict

from sqlalchemy.orm import Session

from app.core.holidays import is_holiday
from app.models.team_policy import TeamPolicy
from app.models.vacation_request import VacationRequest
from app.repositories.team_policy_repo import TeamPolicyRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_request_repo import VacationRequestRepository


class ConflictAnalysisService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.request_repo = VacationRequestRepository(db)
        self.user_repo = UserRepository(db)
        self.policy_repo = TeamPolicyRepository(db)

    @staticmethod
    def _iter_business_days(start_date: date, end_date: date):
        current = start_date
        while current <= end_date:
            if current.weekday() < 5 and not is_holiday(current):
                yield current
            current += timedelta(days=1)

    def analyze_conflict(self, request_id: str) -> dict:
        """
        Analyze a PENDING vacation request and return a conflict report.
        Returns: {
            risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            team_size, max_allowed_off,
            daily_analysis: [{date, occupied, names, available_slots, coverage_pct}],
            overlapping_requests: [{employee_name, start_date, end_date, days}],
            worst_day: {date, occupied, coverage_pct},
            summary: str
        }
        """
        request = self.request_repo.get_by_id(request_id)
        if not request:
            raise ValueError("Solicitud no encontrada.")

        team_id = str(request.team_id)
        start = request.start_date
        end = request.end_date

        # Get team members count
        team_members = self.user_repo.list_all(team_id=team_id)
        team_size = len(team_members)

        # Get overlapping approved requests
        overlapping = self.request_repo.list_team_approved_in_range(team_id, start, end)
        # Exclude the request itself if it was somehow approved
        overlapping = [r for r in overlapping if str(r.id) != request_id]

        # Build employee name map
        emp_names: dict[str, str] = {}
        for r in overlapping:
            eid = str(r.employee_id)
            if eid not in emp_names:
                u = self.user_repo.get_by_id(eid)
                emp_names[eid] = u.full_name if u else "Desconocido"

        # Daily analysis
        daily_analysis = []
        worst_day = None

        for day in self._iter_business_days(start, end):
            policy = self.policy_repo.get_active_for_date(team_id, day)
            max_off = policy.max_people_off_per_day if policy else 1

            # Who is off on this day (approved)
            off_names = []
            for r in overlapping:
                if r.start_date <= day <= r.end_date:
                    off_names.append(emp_names.get(str(r.employee_id), "Desconocido"))

            occupied = len(off_names)
            # +1 because if this request is approved, this person also counts
            occupied_if_approved = occupied + 1
            available_slots = max(0, max_off - occupied_if_approved)
            coverage_pct = round(((team_size - occupied_if_approved) / team_size) * 100, 1) if team_size > 0 else 0

            day_info = {
                "date": day.strftime("%Y-%m-%d"),
                "date_label": day.strftime("%d/%m/%Y"),
                "occupied_current": occupied,
                "occupied_if_approved": occupied_if_approved,
                "off_names": off_names,
                "max_allowed_off": max_off,
                "available_slots": available_slots,
                "coverage_pct": coverage_pct,
                "exceeds_policy": occupied_if_approved > max_off,
            }
            daily_analysis.append(day_info)

            if worst_day is None or coverage_pct < worst_day["coverage_pct"]:
                worst_day = day_info

        # Build overlapping requests summary
        overlap_summary = []
        seen_employees = set()
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

        # Determine risk level
        exceeds_count = sum(1 for d in daily_analysis if d["exceeds_policy"])
        min_coverage = min((d["coverage_pct"] for d in daily_analysis), default=100)

        if exceeds_count > 0:
            risk_level = "CRITICAL"
        elif min_coverage < 50:
            risk_level = "HIGH"
        elif min_coverage < 70:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        # Build summary
        requester = self.user_repo.get_by_id(str(request.employee_id))
        requester_name = requester.full_name if requester else "Empleado"
        bdays_requested = sum(1 for _ in self._iter_business_days(start, end))

        if risk_level == "CRITICAL":
            summary = (
                f"⚠️ CONFLICTO CRÍTICO: Aprobar la solicitud de {requester_name} "
                f"({bdays_requested} días) excedería el límite de ausencias "
                f"en {exceeds_count} día(s). Se recomienda rechazar o sugerir otras fechas."
            )
        elif risk_level == "HIGH":
            summary = (
                f"🔴 Riesgo ALTO: La cobertura mínima del equipo sería del "
                f"{min_coverage}% si se aprueba. Hay {len(overlap_summary)} "
                f"compañero(s) de vacaciones en el mismo período."
            )
        elif risk_level == "MEDIUM":
            summary = (
                f"🟡 Riesgo MEDIO: La cobertura del equipo bajaría al "
                f"{min_coverage}%. Revisa que haya cobertura suficiente."
            )
        else:
            summary = (
                f"🟢 Sin conflictos significativos. Cobertura mínima del equipo: "
                f"{min_coverage}%. Se puede aprobar sin problemas."
            )

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
        }

    def suggest_optimal_dates(
        self,
        employee_id: str,
        desired_days: int,
        search_months: int = 3,
    ) -> list[dict]:
        """
        Suggest date ranges with least conflicts for the employee.
        Scans the next `search_months` months for windows of `desired_days`
        business days with the lowest team occupancy.
        """
        employee = self.user_repo.get_by_id(employee_id)
        if not employee or not employee.team_id:
            raise ValueError("Empleado o equipo no encontrado.")

        team_id = str(employee.team_id)
        team_members = self.user_repo.list_all(team_id=team_id)
        team_size = len(team_members)

        today = date.today()
        scan_end = today + timedelta(days=search_months * 30)

        # Collect all business days in the scan range
        all_bdays = list(self._iter_business_days(today + timedelta(days=1), scan_end))

        if len(all_bdays) < desired_days:
            return []

        # For each business day, compute occupancy
        day_occupancy: dict[date, int] = {}
        for d in all_bdays:
            day_occupancy[d] = self.request_repo.count_team_occupied_on_day(team_id, d)

        # Sliding window of `desired_days` business days
        suggestions = []
        for i in range(len(all_bdays) - desired_days + 1):
            window = all_bdays[i: i + desired_days]
            start_d = window[0]
            end_d = window[-1]

            # Check employee overlap
            existing = self.request_repo.list_by_employee(employee_id)
            has_overlap = False
            for req in existing:
                if req.status.value in ("PENDING", "APPROVED"):
                    if req.start_date <= end_d and req.end_date >= start_d:
                        has_overlap = True
                        break
            if has_overlap:
                continue

            max_occupancy = max(day_occupancy.get(d, 0) for d in window)
            avg_occupancy = sum(day_occupancy.get(d, 0) for d in window) / len(window)
            min_coverage = round(((team_size - max_occupancy - 1) / team_size) * 100, 1) if team_size > 0 else 0

            # Check policy compliance
            policy = self.policy_repo.get_active_for_date(team_id, start_d)
            if policy:
                exceeds = any(day_occupancy.get(d, 0) + 1 > policy.max_people_off_per_day for d in window)
            else:
                exceeds = False

            # Check if it contains a bridge (viernes + lunes)
            has_bridge = False
            for d in window:
                if d.weekday() == 4:  # Friday
                    next_monday = d + timedelta(days=3)
                    if next_monday in window:
                        has_bridge = True
                        break

            suggestions.append({
                "start_date": start_d.strftime("%Y-%m-%d"),
                "end_date": end_d.strftime("%Y-%m-%d"),
                "days": desired_days,
                "max_team_occupancy": max_occupancy,
                "avg_team_occupancy": round(avg_occupancy, 1),
                "min_coverage_pct": min_coverage,
                "exceeds_policy": exceeds,
                "has_bridge": has_bridge,
            })

        # Sort: no policy exceeds first, then highest coverage, then bridges
        suggestions.sort(key=lambda s: (
            s["exceeds_policy"],
            -s["min_coverage_pct"],
            -s["has_bridge"],
        ))

        # Return top 5
        return suggestions[:5]
