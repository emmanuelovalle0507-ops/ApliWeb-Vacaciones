from sqlalchemy.orm import Session

from app.models.balance_adjustment import BalanceAdjustment


class BalanceAdjustmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, adjustment: BalanceAdjustment) -> BalanceAdjustment:
        self.db.add(adjustment)
        self.db.flush()
        self.db.refresh(adjustment)
        return adjustment
