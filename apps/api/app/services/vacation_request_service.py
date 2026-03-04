from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.balance_adjustment import BalanceAdjustment, BalanceAdjustmentType
from app.models.team_policy import TeamPolicy
from app.models.user import UserRole
from app.models.vacation_balance import VacationBalance
from app.models.vacation_request import VacationRequest, VacationRequestStatus
from app.repositories.audit_repo import AuditRepository
from app.repositories.balance_adjustment_repo import BalanceAdjustmentRepository
from app.repositories.team_policy_repo import TeamPolicyRepository
from app.repositories.team_repo import TeamRepository
from app.repositories.user_repo import UserRepository
from app.repositories.vacation_balance_repo import VacationBalanceRepository
from app.repositories.vacation_request_repo import VacationRequestRepository
from app.services.notification_service import NotificationService


class PolicyValidationError(ValueError):
    pass


class VacationRequestService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.user_repo = UserRepository(db)
        self.request_repo = VacationRequestRepository(db)
        self.balance_repo = VacationBalanceRepository(db)
        self.adjustment_repo = BalanceAdjustmentRepository(db)
        self.audit_repo = AuditRepository(db)
        self.team_repo = TeamRepository(db)
        self.policy_repo = TeamPolicyRepository(db)
        self.notif_service = NotificationService(db)

    @staticmethod
    def _calculate_requested_days(start_date: date, end_date: date) -> Decimal:
        if end_date < start_date:
            raise ValueError("Invalid date range")
        count = 0
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:  # Mon-Fri = 0-4
                count += 1
            current = date.fromordinal(current.toordinal() + 1)
        if count <= 0:
            raise ValueError("Date range contains no business days")
        return Decimal(count)

    @staticmethod
    def _to_float(value: Decimal) -> float:
        return float(value.quantize(Decimal("0.01")))

    @staticmethod
    def _today() -> date:
        return datetime.now(timezone.utc).date()

    @staticmethod
    def _iter_business_days(start_date: date, end_date: date):
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:
                yield current
            current = current.fromordinal(current.toordinal() + 1)

    @staticmethod
    def _split_days_by_year(start_date: date, end_date: date) -> dict[int, Decimal]:
        """Split business days count by calendar year."""
        year_days: dict[int, int] = {}
        current = start_date
        while current <= end_date:
            if current.weekday() < 5:
                year_days[current.year] = year_days.get(current.year, 0) + 1
            current = current.fromordinal(current.toordinal() + 1)
        return {yr: Decimal(cnt) for yr, cnt in year_days.items()}

    def _validate_team_daily_capacity(self, team_id: str, start_date: date, end_date: date) -> list[str]:
        """Returns list of warning/error messages. Raises on hard block."""
        warnings: list[str] = []
        for target_day in self._iter_business_days(start_date, end_date):
            policy = self.policy_repo.get_active_for_date(team_id, target_day)
            if not policy:
                raise PolicyValidationError(
                    f"No hay política de equipo configurada para la fecha {target_day.strftime('%d/%m/%Y')}. "
                    "Contacta a tu manager para que configure las reglas del equipo."
                )

            occupied = self.request_repo.count_team_occupied_on_day(team_id, target_day)
            if occupied >= policy.max_people_off_per_day:
                raise PolicyValidationError(
                    f"El {target_day.strftime('%d/%m/%Y')} ya hay {occupied} persona(s) de tu equipo fuera "
                    f"(máximo permitido: {policy.max_people_off_per_day}). Intenta otras fechas."
                )
            elif occupied >= policy.max_people_off_per_day - 1:
                warnings.append(
                    f"El {target_day.strftime('%d/%m/%Y')} queda solo 1 lugar disponible en tu equipo."
                )
        return warnings

    def _validate_employee_basics(self, employee_id: str):
        employee = self.user_repo.get_by_id(employee_id)
        if not employee:
            raise ValueError("Empleado no encontrado.")
        if not employee.manager_id:
            raise ValueError("No tienes un manager asignado. Contacta al administrador.")
        if not employee.team_id:
            raise ValueError("No estás asignado a ningún equipo. Contacta al administrador.")
        manager = self.user_repo.get_by_id(str(employee.manager_id))
        if not manager:
            raise ValueError("Tu manager asignado no fue encontrado. Contacta al administrador.")
        return employee, manager

    def _validate_balance_for_request(self, employee_id: str, start_date: date, end_date: date) -> list[str]:
        """Check balance covers the requested days, split by year. Returns warnings."""
        warnings: list[str] = []
        year_days = self._split_days_by_year(start_date, end_date)

        for yr, days_needed in year_days.items():
            balance = self.balance_repo.get_by_user_year(employee_id, yr)
            if not balance:
                raise PolicyValidationError(
                    f"No tienes saldo de vacaciones registrado para el año {yr}. Contacta al administrador."
                )
            if balance.available_days < days_needed:
                raise PolicyValidationError(
                    f"No tienes suficientes días para el año {yr}. "
                    f"Disponibles: {self._to_float(balance.available_days)}, solicitados: {self._to_float(days_needed)}."
                )
            remaining = balance.available_days - days_needed
            if remaining <= Decimal("2") and remaining > Decimal("0"):
                warnings.append(
                    f"Después de esta solicitud solo te quedarían {self._to_float(remaining)} día(s) para {yr}."
                )
        return warnings

    def _validate_notice_days(self, team_id: str, start_date: date) -> None:
        policy = self.policy_repo.get_active_for_date(team_id, self._today())
        if not policy:
            raise PolicyValidationError(
                "No hay política de equipo configurada. Contacta a tu manager."
            )
        notice_days = (start_date - self._today()).days
        if notice_days < policy.min_notice_days:
            raise PolicyValidationError(
                f"La política de tu equipo requiere mínimo {policy.min_notice_days} días de anticipación. "
                f"Tu solicitud tiene solo {notice_days} día(s) de anticipación."
            )

    def _validate_overlap(self, employee_id: str, start_date: date, end_date: date) -> None:
        existing = self.request_repo.list_by_employee(employee_id)
        for req in existing:
            if req.status.value in ("PENDING", "APPROVED"):
                if req.start_date <= end_date and req.end_date >= start_date:
                    raise PolicyValidationError(
                        f"Ya tienes una solicitud que se traslapa en las fechas "
                        f"{req.start_date.strftime('%d/%m/%Y')} - {req.end_date.strftime('%d/%m/%Y')} "
                        f"(estado: {req.status.value})."
                    )

    def pre_validate(self, employee_id: str, start_date: date, end_date: date) -> dict:
        """Validate without creating. Returns {valid, errors, warnings, requested_days, balance_by_year}."""
        errors: list[str] = []
        warnings: list[str] = []

        try:
            employee, manager = self._validate_employee_basics(employee_id)
        except ValueError as e:
            return {"valid": False, "errors": [str(e)], "warnings": [], "requested_days": 0, "balance_by_year": {}}

        if start_date < self._today():
            errors.append("La fecha de inicio no puede ser en el pasado.")

        if end_date < start_date:
            errors.append("La fecha de fin debe ser igual o posterior a la de inicio.")

        if errors:
            return {"valid": False, "errors": errors, "warnings": warnings, "requested_days": 0, "balance_by_year": {}}

        try:
            requested_days = self._calculate_requested_days(start_date, end_date)
        except ValueError as e:
            return {"valid": False, "errors": [str(e)], "warnings": warnings, "requested_days": 0, "balance_by_year": {}}

        team_id = str(employee.team_id)

        try:
            self._validate_overlap(employee_id, start_date, end_date)
        except PolicyValidationError as e:
            errors.append(str(e))

        try:
            self._validate_notice_days(team_id, start_date)
        except PolicyValidationError as e:
            errors.append(str(e))

        try:
            bal_warnings = self._validate_balance_for_request(employee_id, start_date, end_date)
            warnings.extend(bal_warnings)
        except PolicyValidationError as e:
            errors.append(str(e))

        try:
            cap_warnings = self._validate_team_daily_capacity(team_id, start_date, end_date)
            warnings.extend(cap_warnings)
        except PolicyValidationError as e:
            errors.append(str(e))

        year_days = self._split_days_by_year(start_date, end_date)
        balance_by_year = {}
        for yr, days in year_days.items():
            balance = self.balance_repo.get_by_user_year(employee_id, yr)
            balance_by_year[yr] = {
                "requested": self._to_float(days),
                "available": self._to_float(balance.available_days) if balance else 0,
            }

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "requested_days": self._to_float(requested_days),
            "balance_by_year": balance_by_year,
        }

    def create_request(self, employee_id: str, start_date: date, end_date: date, reason: str | None) -> VacationRequest:
        employee, manager = self._validate_employee_basics(employee_id)

        if start_date < self._today():
            raise ValueError("La fecha de inicio no puede ser en el pasado.")

        requested_days = self._calculate_requested_days(start_date, end_date)
        team_id = str(employee.team_id)

        self._validate_overlap(employee_id, start_date, end_date)
        self._validate_notice_days(team_id, start_date)
        self._validate_balance_for_request(employee_id, start_date, end_date)
        self._validate_team_daily_capacity(team_id, start_date, end_date)

        request = VacationRequest(
            team_id=employee.team_id,
            employee_id=employee.id,
            manager_id=employee.manager_id,
            start_date=start_date,
            end_date=end_date,
            requested_days=requested_days,
            reason=reason,
            status=VacationRequestStatus.PENDING,
        )

        created = self.request_repo.add(request)
        self.db.flush()
        self.audit_repo.add(
            AuditLog(
                actor_user_id=employee.id,
                action="REQUEST_CREATED",
                entity_type="vacation_request",
                entity_id=str(created.id),
                metadata_={"requested_days": self._to_float(created.requested_days)},
            )
        )
        self.db.flush()

        try:
            mgr = self.user_repo.get_by_id(str(employee.manager_id))
            self.notif_service.notify_request_created(
                request_id=str(created.id),
                employee_name=employee.full_name,
                manager_id=str(employee.manager_id),
                start_date=start_date.strftime("%d/%m/%Y"),
                end_date=end_date.strftime("%d/%m/%Y"),
                days=self._to_float(requested_days),
            )
        except Exception:
            pass  # notification failure must not block request creation

        return created

    def list_my_requests(self, employee_id: str) -> list[VacationRequest]:
        return self.request_repo.list_by_employee(employee_id)

    def list_pending_for_manager(self, manager_id: str) -> list[VacationRequest]:
        return self.request_repo.list_pending_by_manager(manager_id)

    def approve(self, request_id: str, manager_id: str, decision_comment: str | None) -> tuple[VacationRequest, VacationBalance]:
        manager_uuid = UUID(manager_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Solicitud no encontrada.")
        if request.manager_id != manager_uuid:
            raise PermissionError("No puedes aprobar esta solicitud porque no eres el manager asignado.")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Esta solicitud ya fue procesada.")

        manager = self.user_repo.get_by_id(manager_id)
        if not manager:
            raise ValueError("Manager no encontrado.")
        if request.team_id and manager.team_id != request.team_id:
            raise PermissionError("No puedes aprobar solicitudes de otro equipo.")

        if request.team_id:
            self._validate_team_daily_capacity(str(request.team_id), request.start_date, request.end_date)

        year_days = self._split_days_by_year(request.start_date, request.end_date)
        balances_to_update: list[tuple[VacationBalance, Decimal]] = []

        for yr, days_needed in year_days.items():
            balance = self.balance_repo.get_by_user_year_for_update(str(request.employee_id), yr)
            if not balance:
                raise ValueError(f"No se encontró saldo de vacaciones para el año {yr}.")
            if balance.available_days < days_needed:
                raise ValueError(
                    f"Saldo insuficiente para {yr}. "
                    f"Disponible: {self._to_float(balance.available_days)}, necesario: {self._to_float(days_needed)}."
                )
            balances_to_update.append((balance, days_needed))

        for balance, days_needed in balances_to_update:
            balance.available_days -= days_needed
            balance.used_days += days_needed
            balance.version += 1

        request.status = VacationRequestStatus.APPROVED
        request.approved_at = datetime.now(timezone.utc)
        request.decision_comment = decision_comment

        self.adjustment_repo.add(
            BalanceAdjustment(
                user_id=request.employee_id,
                request_id=request.id,
                adjustment_type=BalanceAdjustmentType.DEBIT_APPROVAL,
                days_delta=-request.requested_days,
                performed_by=manager_uuid,
                reason=decision_comment,
                operation_key=f"approve:{request.id}",
            )
        )
        self.audit_repo.add(
            AuditLog(
                actor_user_id=manager_uuid,
                action="REQUEST_APPROVED",
                entity_type="vacation_request",
                entity_id=str(request.id),
                metadata_={"days": self._to_float(request.requested_days)},
            )
        )
        self.db.flush()

        try:
            employee = self.user_repo.get_by_id(str(request.employee_id))
            self.notif_service.notify_request_approved(
                request_id=str(request.id),
                employee_id=str(request.employee_id),
                manager_name=manager.full_name,
                start_date=request.start_date.strftime("%d/%m/%Y"),
                end_date=request.end_date.strftime("%d/%m/%Y"),
                days=self._to_float(request.requested_days),
            )
        except Exception:
            pass

        primary_balance = balances_to_update[0][0] if balances_to_update else None
        if not primary_balance:
            raise ValueError("Error interno al actualizar balance.")
        return request, primary_balance

    def reject(self, request_id: str, manager_id: str, decision_comment: str | None) -> VacationRequest:
        manager_uuid = UUID(manager_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Solicitud no encontrada.")
        if request.manager_id != manager_uuid:
            raise PermissionError("No puedes rechazar esta solicitud porque no eres el manager asignado.")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Esta solicitud ya fue procesada.")
        if not decision_comment or not decision_comment.strip():
            raise PolicyValidationError("Debes escribir un comentario al rechazar una solicitud.")

        manager = self.user_repo.get_by_id(manager_id)
        if not manager:
            raise ValueError("Manager no encontrado.")
        if request.team_id and manager.team_id != request.team_id:
            raise PermissionError("No puedes rechazar solicitudes de otro equipo.")

        request.status = VacationRequestStatus.REJECTED
        request.rejected_at = datetime.now(timezone.utc)
        request.decision_comment = decision_comment

        self.audit_repo.add(
            AuditLog(
                actor_user_id=manager_uuid,
                action="REQUEST_REJECTED",
                entity_type="vacation_request",
                entity_id=str(request.id),
                metadata_={"decision_comment": decision_comment},
            )
        )
        self.db.flush()

        try:
            self.notif_service.notify_request_rejected(
                request_id=str(request.id),
                employee_id=str(request.employee_id),
                manager_name=manager.full_name,
                start_date=request.start_date.strftime("%d/%m/%Y"),
                end_date=request.end_date.strftime("%d/%m/%Y"),
                comment=decision_comment,
            )
        except Exception:
            pass

        return request

    def cancel(self, request_id: str, employee_id: str) -> VacationRequest:
        employee_uuid = UUID(employee_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Solicitud no encontrada.")
        if request.employee_id != employee_uuid:
            raise PermissionError("No puedes cancelar la solicitud de otro empleado.")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Solo se pueden cancelar solicitudes pendientes.")

        request.status = VacationRequestStatus.CANCELLED
        request.cancelled_at = datetime.now(timezone.utc)

        self.audit_repo.add(
            AuditLog(
                actor_user_id=employee_uuid,
                action="REQUEST_CANCELLED",
                entity_type="vacation_request",
                entity_id=str(request.id),
                metadata_={},
            )
        )
        self.db.flush()

        try:
            employee = self.user_repo.get_by_id(employee_id)
            if employee and request.manager_id:
                self.notif_service.notify_request_cancelled(
                    request_id=str(request.id),
                    employee_name=employee.full_name,
                    manager_id=str(request.manager_id),
                    start_date=request.start_date.strftime("%d/%m/%Y"),
                    end_date=request.end_date.strftime("%d/%m/%Y"),
                )
        except Exception:
            pass

        return request

    def get_my_balance(self, employee_id: str, year: int) -> VacationBalance:
        balance = self.balance_repo.get_by_user_year(employee_id, year)
        if not balance:
            raise ValueError(f"No se encontró saldo de vacaciones para el año {year}.")
        return balance

    def get_team_policy(self, actor_id: str, target_team_id: str | None = None) -> TeamPolicy:
        actor = self.user_repo.get_by_id(actor_id)
        if not actor:
            raise ValueError("Usuario no encontrado.")

        if target_team_id:
            if actor.role != UserRole.ADMIN and str(actor.team_id) != target_team_id:
                raise PermissionError("No tienes permisos para ver la política de otro equipo.")
            team_id = target_team_id
        else:
            if not actor.team_id:
                raise ValueError("No estás asignado a ningún equipo.")
            team_id = str(actor.team_id)

        policy = self.policy_repo.get_active_for_date(team_id, self._today())
        if not policy:
            raise ValueError("No hay política de equipo configurada.")
        return policy

    def upsert_team_policy(
        self,
        actor_id: str,
        team_id: str,
        max_people_off_per_day: int,
        min_notice_days: int,
        effective_from: date,
        effective_to: date | None,
    ) -> TeamPolicy:
        actor = self.user_repo.get_by_id(actor_id)
        if not actor:
            raise ValueError("Usuario no encontrado.")
        if actor.role == UserRole.EMPLOYEE:
            raise PermissionError("Solo managers y administradores pueden actualizar políticas de equipo.")
        if actor.role == UserRole.MANAGER and str(actor.team_id) != team_id:
            raise PermissionError("Solo puedes actualizar la política de tu propio equipo.")
        if not self.team_repo.get_by_id(team_id):
            raise ValueError("Equipo no encontrado.")
        if effective_to and effective_to < effective_from:
            raise ValueError("La fecha de vigencia final no puede ser anterior a la fecha de inicio.")

        policy = TeamPolicy(
            team_id=team_id,
            max_people_off_per_day=max_people_off_per_day,
            min_notice_days=min_notice_days,
            effective_from=effective_from,
            effective_to=effective_to,
            created_by=UUID(actor_id),
        )
        created = self.policy_repo.add(policy)
        self.db.flush()
        self.audit_repo.add(
            AuditLog(
                actor_user_id=UUID(actor_id),
                action="TEAM_POLICY_UPDATED",
                entity_type="team_policy",
                entity_id=str(created.id),
                metadata_={
                    "team_id": team_id,
                    "max_people_off_per_day": max_people_off_per_day,
                    "min_notice_days": min_notice_days,
                    "effective_from": effective_from.isoformat(),
                    "effective_to": effective_to.isoformat() if effective_to else None,
                },
            )
        )
        self.db.flush()
        return created

    def admin_adjust_balance(self, admin_id: str, user_id: str, year: int, days_delta: Decimal, reason: str | None) -> VacationBalance:
        admin_uuid = UUID(admin_id)
        user_uuid = UUID(user_id)
        balance = self.balance_repo.get_by_user_year_for_update(str(user_uuid), year)
        if not balance:
            balance = VacationBalance(user_id=user_uuid, year=year, available_days=Decimal("0"), used_days=Decimal("0"))
            balance = self.balance_repo.add(balance)

        new_available = balance.available_days + days_delta
        if new_available < 0:
            raise ValueError("El ajuste dejaría un saldo negativo. Saldo actual: " + str(self._to_float(balance.available_days)) + " días.")

        balance.available_days = new_available
        balance.version += 1

        self.adjustment_repo.add(
            BalanceAdjustment(
                user_id=user_uuid,
                request_id=None,
                adjustment_type=BalanceAdjustmentType.ADMIN_MANUAL_ADJUST,
                days_delta=days_delta,
                performed_by=admin_uuid,
                reason=reason,
                operation_key=f"admin-adjust:{user_id}:{year}:{datetime.now(timezone.utc).isoformat()}",
            )
        )
        self.audit_repo.add(
            AuditLog(
                actor_user_id=admin_uuid,
                action="BALANCE_ADJUSTED",
                entity_type="vacation_balance",
                entity_id=f"{user_id}:{year}",
                metadata_={"days_delta": self._to_float(days_delta)},
            )
        )
        self.db.flush()
        return balance
