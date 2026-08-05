"""Unit tests for ElevenLabs adaptive limiter, backoff, Retry-After (Phase 1)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from services.elevenlabs_limiter import (
    ElevenLabsLimiter,
    compute_backoff_seconds,
    parse_retry_after_seconds,
    reset_limiter_for_tests,
)


def test_compute_backoff_exponential_no_jitter():
    assert compute_backoff_seconds(0, base=1, maximum=60, jitter_ratio=0) == 1
    assert compute_backoff_seconds(1, base=1, maximum=60, jitter_ratio=0) == 2
    assert compute_backoff_seconds(2, base=1, maximum=60, jitter_ratio=0) == 4
    assert compute_backoff_seconds(10, base=1, maximum=60, jitter_ratio=0) == 60


def test_compute_backoff_honors_retry_after():
    delay = compute_backoff_seconds(0, retry_after=7.5, base=1, maximum=60, jitter_ratio=0)
    assert delay == 7.5
    delay2 = compute_backoff_seconds(3, retry_after=1, base=1, maximum=60, jitter_ratio=0)
    assert delay2 == 8


def test_compute_backoff_jitter_bounds(monkeypatch):
    vals = [0.0, 1.0]
    monkeypatch.setattr(
        "services.elevenlabs_limiter.random.uniform",
        lambda low, high: vals.pop(0) * (high - low) + low,
    )
    low = compute_backoff_seconds(0, base=4, maximum=60, jitter_ratio=0.25)
    high = compute_backoff_seconds(0, base=4, maximum=60, jitter_ratio=0.25)
    assert low == pytest.approx(3.0)
    assert high == pytest.approx(5.0)


def test_parse_retry_after_from_response_headers():
    exc = SimpleNamespace(
        response=SimpleNamespace(headers={"Retry-After": "3"}),
        status_code=429,
    )
    assert parse_retry_after_seconds(exc) == 3.0

    exc2 = SimpleNamespace(headers={"retry-after": "1.5"})
    assert parse_retry_after_seconds(exc2) == 1.5
    assert parse_retry_after_seconds(Exception("nope")) is None


def test_limiter_caps_active_slots():
    lim = reset_limiter_for_tests(max_concurrency=2, min_concurrency=1, adaptive=False)

    async def _run():
        order: list[str] = []

        async def worker(name: str, hold: float):
            async with lim.slot():
                order.append(f"enter-{name}")
                assert lim.active_slots <= 2
                await asyncio.sleep(hold)
                order.append(f"exit-{name}")

        await asyncio.gather(worker("a", 0.05), worker("b", 0.05), worker("c", 0.01))
        assert lim.active_slots == 0
        assert order.count("enter-a") == 1

    asyncio.run(_run())


def test_limiter_downgrades_to_sequential():
    lim = reset_limiter_for_tests(
        max_concurrency=3,
        min_concurrency=1,
        adaptive=True,
        downgrade_threshold=2,
        recovery_streak=5,
    )

    async def _run():
        assert lim.current_concurrency == 3
        await lim.on_rate_limited(0.01)
        assert lim.current_concurrency == 2
        assert lim.sequential_mode is False
        await lim.on_rate_limited(0.01)
        assert lim.current_concurrency == 1
        assert lim.sequential_mode is True

    asyncio.run(_run())


def test_limiter_recovers_after_success_streak():
    lim = reset_limiter_for_tests(
        max_concurrency=3,
        min_concurrency=1,
        adaptive=True,
        downgrade_threshold=2,
        recovery_streak=2,
    )

    async def _run():
        await lim.on_rate_limited(None)
        await lim.on_rate_limited(None)
        assert lim.sequential_mode is True
        assert lim.current_concurrency == 1

        await lim.on_success()
        await lim.on_success()
        assert lim.current_concurrency == 2
        assert lim.sequential_mode is False

        await lim.on_success()
        await lim.on_success()
        assert lim.current_concurrency == 3

    asyncio.run(_run())
    assert isinstance(lim, ElevenLabsLimiter)


def test_limiter_cooldown_blocks_slots():
    lim = reset_limiter_for_tests(max_concurrency=1, adaptive=True, downgrade_threshold=99)

    async def _run():
        await lim.on_rate_limited(retry_after=0.08)
        loop = asyncio.get_running_loop()
        started = loop.time()
        async with lim.slot():
            elapsed = loop.time() - started
            assert elapsed >= 0.05

    asyncio.run(_run())
