from __future__ import annotations

import math

from fastapi import Query
from pydantic import BaseModel


class PaginationParams:
    """Extracts page / page_size from query‑string and exposes offset/limit."""

    def __init__(
        self,
        page: int = Query(1, ge=1, description="Número de página (desde 1)"),
        page_size: int = Query(20, ge=1, le=100, description="Elementos por página"),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int

    @classmethod
    def build(cls, *, page: int, page_size: int, total: int) -> "PaginationMeta":
        return cls(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=max(1, math.ceil(total / page_size)),
        )
