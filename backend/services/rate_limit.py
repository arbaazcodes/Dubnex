"""
Process-local fixed-window rate limiting for paid / resource-heavy endpoints.

Enforces per-user and per-IP request budgets using thread-safe in-memory
counters (single API replica). For multi-replica deployments, replace the
store with Redis using the same `hit()` interface — budgets stay configured
via config.RATE_LIMIT_* env vars (read at call time for testability).

No architectural changes: this is purely a request gate at the endpoint layer.
"""

from __future__ import annotations

import threading
import time

from fastapi import HTTPException, Request

import config as app_config
from services.firebase_auth import AuthenticatedUser


class _Window:
    __slots__ = ("start", "count")

    def __init__(self, start: float) -> None:
        self.start = start
        self.count = 0


class RateLimiter:
    """Fixed-window counters keyed by identity/IP, pruned periodically."""

    def __init__(self, cleanup_interval: float = 120.0) -> None:
        self._buckets: dict[str, _Window] = {}
        self._lock = threading.Lock()
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.monotonic()

    def _prune(self, now: float) -> None:
        """Drop windows older than the cleanup interval to bound memory."""
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now
        stale = [
            key
            for key, win in self._buckets.items()
            if now - win.start >= self._cleanup_interval
        ]
        for key in stale:
            self._buckets.pop(key, None)

    def hit(self, key: str, limit: int, window_seconds: float) -> tuple[bool, int]:
        """
        Record one request for `key` and return (allowed, retry_after_seconds).

        A fresh window starts when the current one has elapsed; requests over
        `limit` within the window are rejected.
        """
        now = time.monotonic()
        with self._lock:
            self._prune(now)
            win = self._buckets.get(key)
            if win is None or now - win.start >= window_seconds:
                win = _Window(now)
                self._buckets[key] = win
            win.count += 1
            retry_after = max(1, int(window_seconds - (now - win.start)) + 1)
            return win.count <= limit, retry_after

    def reset(self) -> None:
        """Clear all counters (used by tests / process restarts)."""
        with self._lock:
            self._buckets.clear()
            self._last_cleanup = time.monotonic()


_limiter: RateLimiter | None = None


def get_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter()
    return _limiter


def reset_rate_limiter() -> None:
    """Clear all counters — call between tests to avoid budget bleed."""
    get_limiter().reset()


def enforce_rate_limit(request: Request, user: AuthenticatedUser | None = None) -> None:
    """
    Apply per-user then per-IP fixed-window budgets.

    Raises HTTP 429 (with Retry-After) when a budget is exhausted. No-op when
    RATE_LIMIT_ENABLED is false. Config is read at call time so tests and
    runtime can override budgets via env without re-imports.
    """
    if not app_config.RATE_LIMIT_ENABLED:
        return

    window = app_config.RATE_LIMIT_WINDOW_SECONDS
    limiter = get_limiter()
    ip = (request.client.host if request.client else None) or "unknown"

    if user is not None and user.uid:
        allowed, retry_after = limiter.hit(
            f"user:{user.uid}", app_config.RATE_LIMIT_MAX_PER_USER, window
        )
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded for this account. Please retry later.",
                headers={"Retry-After": str(retry_after)},
            )

    allowed, retry_after = limiter.hit(
        f"ip:{ip}", app_config.RATE_LIMIT_MAX_PER_IP, window
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded from this address. Please retry later.",
            headers={"Retry-After": str(retry_after)},
        )
