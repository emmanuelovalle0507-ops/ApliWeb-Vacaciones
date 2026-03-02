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
    def _iter_days(start_date: date, end_date: date):
        current = start_date
        while current <= end_date:
            yield current
            current = current.fromordinal(current.toordinal() + 1)

    def _validate_team_daily_capacity(self, team_id: str, start_date: date, end_date: date) -> None:
        for target_day in self._iter_days(start_date, end_date):
            policy = self.policy_repo.get_active_for_date(team_id, target_day)
            if not policy:
                raise ValueError("Team policy not configured for requested dates")

            occupied = self.request_repo.count_team_occupied_on_day(team_id, target_day)
            if occupied >= policy.max_people_off_per_day:
                raise ValueError(f"Team daily capacity reached for {target_day.isoformat()}")

    def create_request(self, employee_id: str, start_date: date, end_date: date, reason: str | None) -> VacationRequest:
        employee = self.user_repo.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")
        if not employee.manager_id:
            raise ValueError("Employee has no assigned manager")
        if not employee.team_id:
            raise ValueError("Employee has no assigned team")

        manager = self.user_repo.get_by_id(str(employee.manager_id))
        if not manager:
            raise ValueError("Assigned manager not found")
        if manager.team_id != employee.team_id:
            raise ValueError("Employee and manager must belong to the same team")

        if start_date < self._today():
            raise ValueError("Start date cannot be in the past")

        requested_days = self._calculate_requested_days(start_date, end_date)
        team_id = str(employee.team_id)

        existing = self.request_repo.list_by_employee(employee_id)
        for req in existing:
            if req.status.value in ("PENDING", "APPROVED"):
                if req.start_date <= end_date and req.end_date >= start_date:
                    raise ValueError(
                        f"Overlapping request exists ({req.start_date.isoformat()} - {req.end_date.isoformat()})"
                    )

        policy_today = self.policy_repo.get_active_for_date(team_id, self._today())
        if not policy_today:
            raise ValueError("Team policy not configured")

        notice_days = (start_date - self._today()).days
        if notice_days < policy_today.min_notice_days and not (reason and reason.strip()):
            raise PolicyValidationError("Reason is required for requests below minimum notice days")

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
        return created

    def list_my_requests(self, employee_id: str) -> list[VacationRequest]:
        return self.request_repo.list_by_employee(employee_id)

    def list_pending_for_manager(self, manager_id: str) -> list[VacationRequest]:
        return self.request_repo.list_pending_by_manager(manager_id)

    def approve(self, request_id: str, manager_id: str, decision_comment: str | None) -> tuple[VacationRequest, VacationBalance]:
        manager_uuid = UUID(manager_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Request not found")
        if request.manager_id != manager_uuid:
            raise PermissionError("Manager cannot approve this request")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Request already processed")

        manager = self.user_repo.get_by_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        if request.team_id and manager.team_id != request.team_id:
            raise PermissionError("Manager cannot approve requests from another team")

        if request.team_id:
            self._validate_team_daily_capacity(str(request.team_id), request.start_date, request.end_date)

        balance_year = request.start_date.year
        balance = self.balance_repo.get_by_user_year_for_update(str(request.employee_id), balance_year)
        if not balance:
            raise ValueError("Vacation balance not found")

        if balance.available_days < request.requested_days:
            raise ValueError("Insufficient balance")

        balance.available_days -= request.requested_days
        balance.used_days += request.requested_days
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

        return request, balance

    def reject(self, request_id: str, manager_id: str, decision_comment: str | None) -> VacationRequest:
        manager_uuid = UUID(manager_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Request not found")
        if request.manager_id != manager_uuid:
            raise PermissionError("Manager cannot reject this request")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Request already processed")
        if not decision_comment or not decision_comment.strip():
            raise PolicyValidationError("Decision comment is required when rejecting a request")

        manager = self.user_repo.get_by_id(manager_id)
        if not manager:
            raise ValueError("Manager not found")
        if request.team_id and manager.team_id != request.team_id:
            raise PermissionError("Manager cannot reject requests from another team")

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
        return request

    def cancel(self, request_id: str, employee_id: str) -> VacationRequest:
        employee_uuid = UUID(employee_id)
        request = self.request_repo.get_by_id_for_update(request_id)
        if not request:
            raise ValueError("Request not found")
        if request.employee_id != employee_uuid:
            raise PermissionError("Cannot cancel another employee request")
        if request.status != VacationRequestStatus.PENDING:
            raise ValueError("Only pending requests can be cancelled")

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
        return request

    def get_my_balance(self, employee_id: str, year: int) -> VacationBalance:
        balance = self.balance_repo.get_by_user_year(employee_id, year)
        if not balance:
            raise ValueError("Balance not found")
        return balance

    def get_team_policy(self, actor_id: str, target_team_id: str | None = None) -> TeamPolicy:
        actor = self.user_repo.get_by_id(actor_id)
        if not actor:
            raise ValueError("User not found")

        if target_team_id:
            if actor.role != UserRole.ADMIN and str(actor.team_id) != target_team_id:
                raise PermissionError("Cannot view policy for another team")
            team_id = target_team_id
        else:
            if not actor.team_id:
                raise ValueError("User has no assigned team")
            team_id = str(actor.team_id)

        policy = self.policy_repo.get_active_for_date(team_id, self._today())
        if not policy:
            raise ValueError("Team policy not found")
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
            raise ValueError("User not found")
        if actor.role == UserRole.EMPLOYEE:
            raise PermissionError("Only manager/admin can update team policy")
        if actor.role == UserRole.MANAGER and str(actor.team_id) != team_id:
            raise PermissionError("Manager can only update own team policy")
        if not self.team_repo.get_by_id(team_id):
            raise ValueError("Team not found")
        if effective_to and effective_to < effective_from:
            raise ValueError("Invalid policy effective date range")

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
            raise ValueError("Adjustment would leave negative balance")

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
