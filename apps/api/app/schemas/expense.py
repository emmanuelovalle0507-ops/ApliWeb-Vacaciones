from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.pagination import PaginationMeta


# ── Receipt ────────────────────────────────────────────
class ReceiptOut(BaseModel):
    id: str
    reportId: str | None = None
    ownerId: str
    fileUrl: str
    fileName: str
    fileContentType: str
    fileSizeBytes: int
    ocrText: str | None = None
    extractionJson: dict[str, Any] | None = None
    extractionStatus: str
    extractionConfidence: float | None = None
    vendorName: str | None = None
    receiptDate: date | None = None
    totalAmount: float | None = None
    currency: str | None = None
    taxAmount: float | None = None
    paymentMethod: str | None = None
    category: str | None = None
    description: str | None = None
    decision: str = "PENDING"
    decisionComment: str | None = None
    decidedBy: str | None = None
    decidedAt: datetime | None = None
    createdAt: datetime
    updatedAt: datetime


class ManualReceiptIn(BaseModel):
    """Create a receipt manually (no file upload)."""
    vendorName: str = Field(..., min_length=1, max_length=200)
    receiptDate: date
    totalAmount: float = Field(..., gt=0)
    currency: str = "MXN"
    taxAmount: float | None = None
    paymentMethod: str | None = None
    category: str | None = None
    description: str | None = None


class ReceiptUpdateIn(BaseModel):
    vendorName: str | None = None
    receiptDate: date | None = None
    totalAmount: float | None = None
    currency: str | None = None
    taxAmount: float | None = None
    paymentMethod: str | None = None
    category: str | None = None
    description: str | None = None


class PaginatedReceiptList(BaseModel):
    items: list[ReceiptOut]
    pagination: PaginationMeta


# ── Report ─────────────────────────────────────────────
class ReportCreateIn(BaseModel):
    title: str
    periodStart: date
    periodEnd: date
    receiptIds: list[str] = []
    currency: str = "MXN"


class ReportUpdateIn(BaseModel):
    title: str | None = None
    periodStart: date | None = None
    periodEnd: date | None = None


class ReportOut(BaseModel):
    id: str
    ownerId: str
    ownerName: str | None = None
    teamId: str | None = None
    teamName: str | None = None
    title: str
    periodStart: date
    periodEnd: date
    status: str
    totalAmount: float | None = None
    currency: str
    submittedAt: datetime | None = None
    decisionComment: str | None = None
    decidedBy: str | None = None
    decidedAt: datetime | None = None
    paymentStatus: str = "PENDING"
    paymentProofUrl: str | None = None
    paidAt: datetime | None = None
    paidBy: str | None = None
    createdAt: datetime
    updatedAt: datetime
    receipts: list[ReceiptOut] = []
    receiptCount: int = 0


class PaginatedReportList(BaseModel):
    items: list[ReportOut]
    pagination: PaginationMeta


class DecisionIn(BaseModel):
    comment: str | None = None


class ReceiptDecisionIn(BaseModel):
    """Finance decides on a single receipt within a report."""
    decision: str  # APPROVED or REJECTED
    comment: str | None = None


class FinalizeReviewIn(BaseModel):
    """Finalize review of a report after per-ticket decisions."""
    comment: str | None = None


# ── Analytics ──────────────────────────────────────────
class ExpenseAnalytics(BaseModel):
    totalReports: int = 0
    totalReceipts: int = 0
    totalAmount: float = 0
    totalTax: float = 0
    byStatus: dict[str, int] = {}
    byCategory: dict[str, float] = {}
    byMonth: list[dict[str, Any]] = []
    topVendors: list[dict[str, Any]] = []
