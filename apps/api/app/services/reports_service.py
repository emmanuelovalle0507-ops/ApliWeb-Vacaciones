"""
CSV report generation for vacation requests and balances.
"""

import csv
import io
from datetime import date

from sqlalchemy.orm import Session

from app.repositories.user_repo import UserRepository
from app.repositories.team_repo import TeamRepository
from app.repositories.vacation_balance_repo import VacationBalanceRepository
from app.repositories.vacation_request_repo import VacationRequestRepository


class ReportsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.team_repo = TeamRepository(db)
        self.balance_repo = VacationBalanceRepository(db)
        self.request_repo = VacationRequestRepository(db)

    def generate_requests_csv(self, start_date: date, end_date: date) -> str:
        """Generate CSV of all requests in the given date range."""
        requests = self.request_repo.list_all(start_date=start_date, end_date=end_date)
        teams_cache: dict[str, str] = {}
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Empleado", "Area", "Fecha Inicio", "Fecha Fin",
            "Dias Solicitados", "Estado", "Comentario", "Decidido Por", "Fecha Decision",
        ])

        for req in requests:
            employee = self.user_repo.get_by_id(str(req.employee_id))
            emp_name = employee.full_name if employee else "—"
            area = "—"
            if req.team_id:
                tid = str(req.team_id)
                if tid not in teams_cache:
                    t = self.team_repo.get_by_id(tid)
                    teams_cache[tid] = t.name if t else "—"
                area = teams_cache[tid]

            manager = self.user_repo.get_by_id(str(req.manager_id)) if req.manager_id else None
            decided_at = (
                (req.approved_at or req.rejected_at or req.cancelled_at or "").isoformat()
                if (req.approved_at or req.rejected_at or req.cancelled_at)
                else ""
            )

            writer.writerow([
                emp_name,
                area,
                req.start_date.isoformat(),
                req.end_date.isoformat(),
                float(req.requested_days),
                req.status.value,
                req.reason or "",
                manager.full_name if manager else "",
                decided_at,
            ])

        return output.getvalue()

    def generate_balances_csv(self, year: int) -> str:
        """Generate CSV of all balances for a year."""
        balances = self.balance_repo.list_by_year(year)
        teams_cache: dict[str, str] = {}
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Empleado", "Area", "Año", "Otorgados", "Arrastrados", "Usados", "Disponibles",
        ])

        for b in balances:
            user = self.user_repo.get_by_id(str(b.user_id))
            u_name = user.full_name if user else "—"
            u_area = "—"
            if user and user.team_id:
                tid = str(user.team_id)
                if tid not in teams_cache:
                    t = self.team_repo.get_by_id(tid)
                    teams_cache[tid] = t.name if t else "—"
                u_area = teams_cache[tid]

            granted = float(b.available_days) + float(b.used_days)
            carried = float(getattr(b, "carried_over_days", 0))
            writer.writerow([
                u_name, u_area, b.year,
                granted, carried,
                float(b.used_days), float(b.available_days),
            ])

        return output.getvalue()
