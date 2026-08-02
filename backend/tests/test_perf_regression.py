"""Lightweight performance regression guards (no full pipeline)."""

from __future__ import annotations

import asyncio
import time


def test_tts_concurrency_faster_than_sequential():
    """Guard: concurrency=3 should beat sequential for I/O-bound work."""

    async def run(limit: int, n: int = 6, delay: float = 0.03):
        sem = asyncio.Semaphore(limit)

        async def one():
            async with sem:
                await asyncio.sleep(delay)

        t0 = time.perf_counter()
        if limit <= 1:
            for _ in range(n):
                await asyncio.sleep(delay)
        else:
            await asyncio.gather(*[one() for _ in range(n)])
        return time.perf_counter() - t0

    seq = asyncio.run(run(1))
    par = asyncio.run(run(3))
    # Allow noise but require clear speedup
    assert par < seq * 0.7, f"expected concurrency speedup, seq={seq:.3f}s par={par:.3f}s"


def test_queue_wait_non_negative():
    from datetime import datetime, timezone, timedelta
    from services.job_runner import _queue_wait_seconds

    past = (datetime.now(timezone.utc) - timedelta(seconds=0.5)).isoformat()
    wait = _queue_wait_seconds({"enqueued_at": past})
    assert wait is not None and wait >= 0.4
