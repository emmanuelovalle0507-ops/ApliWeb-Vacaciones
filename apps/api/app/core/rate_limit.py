"""
In-memory rate limiter for sensitive endpoints (login, forgot-password).
Uses a sliding window approach with automatic cleanup.

For horizontal scaling (multiple containers), replace with Redis-based limiter.
"""

import time
import threading
from collections import defaultdict
from functools import wraps

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Thread-safe in-memory rate limiter with sliding window."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        """Raise 429 if key has exceeded max_requests in the last window_seconds."""
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            # Remove expired entries
            self._hits[key] = [t for t in self._hits[key] if t > cutoff]

            if len(self._hits[key]) >= max_requests:
                retry_after = int(self._hits[key][0] + window_seconds - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Demasiados intentos. Intenta de nuevo en {retry_after} segundos.",
                    headers={"Retry-After": str(retry_after)},
                )

            self._hits[key].append(now)

    def cleanup(self, max_age_seconds: int = 600) -> None:
        """Remove all entries older than max_age_seconds. Call periodically if needed."""
        cutoff = time.time() - max_age_seconds
        with self._lock:
            empty_keys = []
            for key, timestamps in self._hits.items():
                self._hits[key] = [t for t in timestamps if t > cutoff]
                if not self._hits[key]:
                    empty_keys.append(key)
            for key in empty_keys:
                del self._hits[key]


# Singleton instance
limiter = RateLimiter()
