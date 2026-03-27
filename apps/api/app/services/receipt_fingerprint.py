"""Compute a content-based fingerprint for duplicate receipt detection.

The hash is built from normalized extracted fields so that the same physical
receipt yields the same hash regardless of who uploads it or which file
format is used.

For CFDI receipts the uuid_fiscal alone is already unique, but we still
compute a content_hash so that non-CFDI duplicates are caught too.
"""

from __future__ import annotations

import hashlib
from datetime import date
from decimal import Decimal


def compute_content_hash(
    *,
    vendor_name: str | None = None,
    receipt_date: date | None = None,
    total_amount: float | Decimal | None = None,
    currency: str | None = None,
    tax_amount: float | Decimal | None = None,
    uuid_fiscal: str | None = None,
    rfc_emisor: str | None = None,
    line_items: list[dict] | None = None,
) -> str | None:
    """Return a SHA-256 hex digest fingerprint, or None if insufficient data."""

    parts: list[str] = []

    # --- CFDI path: uuid_fiscal is the strongest identifier ---
    if uuid_fiscal and len(uuid_fiscal) >= 32:
        parts.append(f"uuid:{uuid_fiscal.strip().upper()}")
        # CFDI UUID alone is unique enough, return early
        return hashlib.sha256("|".join(parts).encode()).hexdigest()

    # --- Non-CFDI path: need at least vendor + total to fingerprint ---
    norm_vendor = (vendor_name or "").strip().upper()
    norm_total = _norm_amount(total_amount)

    if not norm_vendor or norm_total is None:
        return None  # not enough data to fingerprint

    parts.append(f"vendor:{norm_vendor}")
    parts.append(f"total:{norm_total}")
    parts.append(f"currency:{(currency or 'MXN').strip().upper()}")

    if receipt_date is not None:
        parts.append(f"date:{receipt_date.isoformat()}")

    if tax_amount is not None:
        parts.append(f"tax:{_norm_amount(tax_amount)}")

    if rfc_emisor:
        parts.append(f"rfc:{rfc_emisor.strip().upper()}")

    # Include line item descriptions + amounts for extra specificity
    if line_items:
        for item in sorted(line_items, key=lambda x: str(x.get("description", ""))):
            desc = str(item.get("description", "")).strip().upper()
            amt = _norm_amount(item.get("amount"))
            if desc or amt is not None:
                parts.append(f"item:{desc}:{amt}")

    return hashlib.sha256("|".join(parts).encode()).hexdigest()


def _norm_amount(val) -> str | None:
    """Normalize a monetary amount to 2-decimal string."""
    if val is None:
        return None
    try:
        return f"{float(val):.2f}"
    except (ValueError, TypeError):
        return None
