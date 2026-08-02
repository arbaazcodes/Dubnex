"""
Micro-benchmarks for Sprint 15 performance changes.
Run from backend/: python scripts/bench_performance.py
"""

from __future__ import annotations

import asyncio
import os
import sys
import time

# Ensure backend root on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)


def bench_translation():
    from services.translator_service import _translate_batch, translate_text

    texts = [
        "Hello world.",
        "How are you today?",
        "This is a performance test.",
        "Please translate quickly.",
        "Batching should reduce overhead.",
        "Another short sentence.",
        "Latency matters for dubbing.",
        "Final sample line.",
    ] * 2  # 16 items

    # Sequential (batch size 1)
    t0 = time.perf_counter()
    seq = []
    for t in texts:
        seq.append(translate_text(t, "en", "hi"))
    seq_ms = (time.perf_counter() - t0) * 1000

    # Batched
    t0 = time.perf_counter()
    bat = _translate_batch(texts, "en", "hi")
    bat_ms = (time.perf_counter() - t0) * 1000

    # Output length sanity (same count)
    assert len(seq) == len(bat) == len(texts)
    return {
        "segments": len(texts),
        "sequential_ms": round(seq_ms, 1),
        "batched_ms": round(bat_ms, 1),
        "speedup": round(seq_ms / bat_ms, 2) if bat_ms else None,
    }


async def bench_tts_concurrency():
    """Simulate ElevenLabs I/O with sleep; measure concurrency effect."""
    import asyncio

    n = 9
    per_call = 0.05

    async def sequential():
        for _ in range(n):
            await asyncio.sleep(per_call)

    async def concurrent(limit: int):
        sem = asyncio.Semaphore(limit)

        async def one():
            async with sem:
                await asyncio.sleep(per_call)

        await asyncio.gather(*[one() for _ in range(n)])

    t0 = time.perf_counter()
    await sequential()
    seq_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    await concurrent(1)
    c1_ms = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    await concurrent(3)
    c3_ms = (time.perf_counter() - t0) * 1000

    return {
        "segments": n,
        "simulated_call_ms": per_call * 1000,
        "sequential_ms": round(seq_ms, 1),
        "concurrency_1_ms": round(c1_ms, 1),
        "concurrency_3_ms": round(c3_ms, 1),
        "speedup_3x_vs_seq": round(seq_ms / c3_ms, 2) if c3_ms else None,
    }


def bench_queue_wait_metric():
    from datetime import datetime, timezone, timedelta
    from services.job_runner import _queue_wait_seconds

    past = (datetime.now(timezone.utc) - timedelta(seconds=1.25)).isoformat()
    wait = _queue_wait_seconds({"enqueued_at": past})
    return {"measured_wait_sec": round(wait or 0, 3)}


def main():
    print("=== Translation batching ===")
    tr = bench_translation()
    print(tr)
    print("=== TTS concurrency (simulated I/O) ===")
    tts = asyncio.run(bench_tts_concurrency())
    print(tts)
    print("=== Queue wait parsing ===")
    qw = bench_queue_wait_metric()
    print(qw)
    return {"translation": tr, "tts": tts, "queue_wait": qw}


if __name__ == "__main__":
    main()
