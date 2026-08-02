"""
Background worker entrypoint.

  python -m worker

Dequeues Redis jobs and runs process_queued_job() (reuses process_video).
Warms Whisper (and optionally translation) on startup for lower first-job latency.
"""

from __future__ import annotations

import signal
import sys
import time

from config import WHISPER_WARMUP
from services.db import init_db
from services.logging_service import configure_logging, get_logger
from services.queue_service import dequeue_job, resolve_backend
from services.job_runner import process_queued_job
from services.perf_service import warm_translation_model, warm_whisper_model

_running = True


def _stop(*_args):
    global _running
    _running = False


def main() -> int:
    configure_logging()
    log = get_logger("screen_ai.worker_main")
    backend = resolve_backend()
    if backend != "redis":
        log.error(
            "Worker requires Redis (QUEUE_BACKEND=redis and REDIS_URL). Current=%s",
            backend,
        )
        return 1

    try:
        init_db()
    except Exception as exc:
        log.warning("database init failed: %s", exc)

    if WHISPER_WARMUP:
        warm = warm_whisper_model()
        log.info("whisper warmup result", extra={"event": "whisper_warmup", **warm})
        # Translation model is imported with the pipeline; warm with a tiny string.
        tw = warm_translation_model()
        log.info("translation warmup result", extra={"event": "translation_warmup", **tw})

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    log.info("worker started", extra={"event": "worker_boot", "component": "worker"})
    while _running:
        try:
            payload = dequeue_job()
            if not payload:
                continue
            log.info(
                "dequeued job",
                extra={
                    "event": "worker_dequeue",
                    "job_id": payload.get("job_id"),
                    "attempt": payload.get("attempt"),
                },
            )
            process_queued_job(payload)
        except Exception as exc:
            log.exception("worker loop error: %s", exc, extra={"event": "worker_loop_error"})
            time.sleep(1)

    log.info("worker stopped", extra={"event": "worker_shutdown"})
    return 0


if __name__ == "__main__":
    sys.exit(main())
