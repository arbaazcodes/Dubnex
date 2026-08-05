"""
Process-local adaptive concurrency limiter for ElevenLabs TTS (Phase 1).

No Redis shared budget here — that is Phase 2.
"""

from __future__ import annotations

import asyncio
import random
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from config import (
    TTS_ADAPTIVE_ENABLED,
    TTS_BACKOFF_BASE_SECONDS,
    TTS_BACKOFF_JITTER_RATIO,
    TTS_BACKOFF_MAX_SECONDS,
    TTS_CONCURRENCY,
    TTS_CONCURRENCY_MIN,
    TTS_DOWNGRADE_THRESHOLD,
    TTS_RECOVERY_SUCCESS_STREAK,
)
from services.logging_service import get_logger

logger = get_logger("screen_ai.elevenlabs_limiter")


def compute_backoff_seconds(
    attempt: int,
    *,
    retry_after: float | None = None,
    base: float | None = None,
    maximum: float | None = None,
    jitter_ratio: float | None = None,
) -> float:
    """
    Exponential backoff with equal jitter.

    attempt: 0-based retry index (first retry after failure => 0).
    If retry_after is set, use max(retry_after, base_delay) then apply jitter.
    """
    base_s = TTS_BACKOFF_BASE_SECONDS if base is None else base
    max_s = TTS_BACKOFF_MAX_SECONDS if maximum is None else maximum
    jitter = TTS_BACKOFF_JITTER_RATIO if jitter_ratio is None else jitter_ratio

    exp = min(max_s, base_s * (2 ** max(0, attempt)))
    if retry_after is not None and retry_after > 0:
        delay = max(float(retry_after), exp)
    else:
        delay = exp
    delay = min(max_s, delay)
    if jitter <= 0:
        return delay
    # Equal jitter: delay * U(1-j, 1+j) clamped to [0, max]
    low = max(0.0, 1.0 - jitter)
    high = 1.0 + jitter
    return min(max_s, delay * random.uniform(low, high))


def parse_retry_after_seconds(exc: BaseException) -> float | None:
    """Extract Retry-After (seconds) from SDK / HTTP-like exceptions."""
    headers = None
    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
    if headers is None:
        headers = getattr(exc, "headers", None)
    if not headers:
        return None

    raw = None
    try:
        raw = headers.get("Retry-After")  # type: ignore[union-attr]
    except Exception:
        raw = None
    if raw is None:
        try:
            raw = headers.get("retry-after")  # type: ignore[union-attr]
        except Exception:
            raw = None
    if raw is None:
        return None

    text = str(raw).strip()
    if not text:
        return None
    try:
        return max(0.0, float(text))
    except ValueError:
        return None


class ElevenLabsLimiter:
    """
    Adaptive slot gate: current concurrency in [min, max], AIMD-style.

    On rate limit: shrink (and after threshold force sequential).
    On success streak: grow back toward max.
    """

    def __init__(
        self,
        *,
        max_concurrency: int | None = None,
        min_concurrency: int | None = None,
        adaptive: bool | None = None,
        downgrade_threshold: int | None = None,
        recovery_streak: int | None = None,
    ) -> None:
        self._max = max(1, max_concurrency if max_concurrency is not None else TTS_CONCURRENCY)
        self._min = max(
            1,
            min(
                self._max,
                min_concurrency if min_concurrency is not None else TTS_CONCURRENCY_MIN,
            ),
        )
        self._adaptive = TTS_ADAPTIVE_ENABLED if adaptive is None else adaptive
        self._downgrade_threshold = (
            TTS_DOWNGRADE_THRESHOLD if downgrade_threshold is None else downgrade_threshold
        )
        self._recovery_streak_needed = (
            TTS_RECOVERY_SUCCESS_STREAK if recovery_streak is None else recovery_streak
        )

        self._current = self._max
        self._active = 0
        self._success_streak = 0
        self._rate_limit_hits = 0
        self._sequential = False
        self._cooldown_until = 0.0
        self._cond = asyncio.Condition()

    @property
    def current_concurrency(self) -> int:
        return self._current

    @property
    def sequential_mode(self) -> bool:
        return self._sequential

    @property
    def active_slots(self) -> int:
        return self._active

    def snapshot(self) -> dict:
        return {
            "current": self._current,
            "max": self._max,
            "min": self._min,
            "active": self._active,
            "sequential": self._sequential,
            "success_streak": self._success_streak,
            "rate_limit_hits": self._rate_limit_hits,
            "cooldown_remaining": max(0.0, self._cooldown_until - time.monotonic()),
        }

    async def _wait_ready_locked(self) -> None:
        while True:
            now = time.monotonic()
            if now < self._cooldown_until:
                wait = self._cooldown_until - now
                try:
                    await asyncio.wait_for(self._cond.wait(), timeout=wait)
                except asyncio.TimeoutError:
                    continue
                continue
            if self._active < self._current:
                return
            await self._cond.wait()

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        async with self._cond:
            await self._wait_ready_locked()
            self._active += 1
        try:
            yield
        finally:
            async with self._cond:
                self._active = max(0, self._active - 1)
                self._cond.notify_all()

    async def on_success(self) -> None:
        if not self._adaptive:
            return
        async with self._cond:
            self._success_streak += 1
            self._rate_limit_hits = 0
            if self._success_streak >= self._recovery_streak_needed and self._current < self._max:
                prev = self._current
                self._current = min(self._max, self._current + 1)
                self._success_streak = 0
                if self._current > 1:
                    self._sequential = False
                logger.info(
                    "TTS concurrency increased",
                    extra={
                        "event": "tts_concurrency_change",
                        "from": prev,
                        "to": self._current,
                        "sequential": self._sequential,
                    },
                )
                self._cond.notify_all()

    async def on_rate_limited(self, retry_after: float | None = None) -> float:
        """
        Apply cooldown + shrink concurrency. Returns recommended wait seconds
        (caller should still sleep using compute_backoff_seconds for attempt index).
        """
        wait_hint = 0.0
        async with self._cond:
            self._success_streak = 0
            self._rate_limit_hits += 1
            if retry_after is not None and retry_after > 0:
                self._cooldown_until = max(
                    self._cooldown_until,
                    time.monotonic() + float(retry_after),
                )
                wait_hint = float(retry_after)

            if self._adaptive:
                prev = self._current
                if self._rate_limit_hits >= self._downgrade_threshold:
                    self._current = self._min
                    self._sequential = True
                else:
                    self._current = max(self._min, self._current - 1)
                    if self._current <= self._min:
                        self._sequential = True

                if prev != self._current or self._sequential:
                    logger.warning(
                        "TTS concurrency decreased after rate limit",
                        extra={
                            "event": "tts_concurrency_change",
                            "from": prev,
                            "to": self._current,
                            "sequential": self._sequential,
                            "rate_limit_hits": self._rate_limit_hits,
                            "retry_after": retry_after,
                        },
                    )
                    if self._sequential:
                        logger.warning(
                            "TTS entered sequential mode",
                            extra={"event": "tts_mode_sequential"},
                        )
            self._cond.notify_all()
        return wait_hint


_limiter: ElevenLabsLimiter | None = None


def get_limiter() -> ElevenLabsLimiter:
    global _limiter
    if _limiter is None:
        _limiter = ElevenLabsLimiter()
    return _limiter


def reset_limiter_for_tests(
    *,
    max_concurrency: int | None = None,
    min_concurrency: int | None = None,
    adaptive: bool | None = None,
    downgrade_threshold: int | None = None,
    recovery_streak: int | None = None,
) -> ElevenLabsLimiter:
    """Replace process singleton (unit tests only)."""
    global _limiter
    _limiter = ElevenLabsLimiter(
        max_concurrency=max_concurrency,
        min_concurrency=min_concurrency,
        adaptive=adaptive,
        downgrade_threshold=downgrade_threshold,
        recovery_streak=recovery_streak,
    )
    return _limiter
