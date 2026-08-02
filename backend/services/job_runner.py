"""
Execute a queued dubbing job: call process_video(), persist progress, retry on failure.

Shared by the Redis worker process and the inline API fallback.
Does not modify AI pipeline logic — only invokes process_video().
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any

from services.job_service import fail_job, finish_job, get_job, update_job
from services.logging_service import get_logger, reset_job_id, set_job_id
from services.metrics_service import observe_queue_wait, observe_worker_job
from services.pipeline_service import process_video
from services.queue_service import enqueue_job, should_retry

logger = get_logger("screen_ai.worker")


def _queue_wait_seconds(payload: dict[str, Any]) -> float | None:
    raw = payload.get("enqueued_at")
    if not raw:
        return None
    try:
        text = str(raw).replace("Z", "+00:00")
        enqueued = datetime.fromisoformat(text)
        if enqueued.tzinfo is None:
            enqueued = enqueued.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - enqueued).total_seconds())
    except Exception:
        return None


def process_queued_job(payload: dict[str, Any]) -> None:
    job_id = payload.get("job_id")
    video_path = payload.get("video_path")
    target_language = payload.get("target_language") or "en"
    voice = payload.get("voice") or "george"
    attempt = int(payload.get("attempt") or 0)
    max_retries = int(payload.get("max_retries") if payload.get("max_retries") is not None else 3)

    if not job_id or not video_path:
        logger.error("invalid job payload", extra={"event": "worker_bad_payload"})
        return

    token = set_job_id(job_id)
    try:
        # Ensure job is visible in this process (hydrate from DB if needed)
        job = get_job(job_id, refresh=True)
        if not job:
            logger.error("job not found", extra={"event": "worker_job_missing", "job_id": job_id})
            return

        if not os.path.isfile(video_path):
            fail_job(job_id, FileNotFoundError(f"Upload missing for job: {video_path}"))
            return

        wait_sec = _queue_wait_seconds(payload)
        if wait_sec is not None:
            observe_queue_wait(wait_sec)
            logger.info(
                "queue wait measured",
                extra={
                    "event": "queue_wait",
                    "job_id": job_id,
                    "duration_ms": round(wait_sec * 1000, 2),
                },
            )

        update_job(
            job_id,
            status="processing",
            message=f"Worker started (attempt {attempt + 1}/{max_retries + 1})",
        )

        def on_progress(stage, message=""):
            update_job(job_id, stage=stage, message=message)

        started = time.perf_counter()
        try:
            result = asyncio.run(
                process_video(
                    video_path=video_path,
                    target_language=target_language,
                    voice=voice,
                    on_progress=on_progress,
                )
            )
            finish_job(job_id, result)
            elapsed = time.perf_counter() - started
            observe_worker_job("completed", elapsed)
            profile = (result or {}).get("stage_profile") or {}
            logger.info(
                "worker job completed",
                extra={
                    "event": "worker_completed",
                    "job_id": job_id,
                    "attempt": attempt,
                    "duration_ms": round(elapsed * 1000, 2),
                    "stage": "Completed",
                },
            )
            if profile:
                logger.info(
                    "worker stage profile",
                    extra={
                        "event": "worker_stage_profile",
                        "job_id": job_id,
                        **{f"ms_{k}": v for k, v in profile.items()},
                    },
                )
        except Exception as exc:
            elapsed = time.perf_counter() - started
            next_attempt = attempt + 1
            if should_retry(next_attempt, max_retries):
                logger.warning(
                    "worker job failed; requeue",
                    extra={
                        "event": "worker_retry",
                        "job_id": job_id,
                        "attempt": next_attempt,
                        "error_type": type(exc).__name__,
                        "duration_ms": round(elapsed * 1000, 2),
                    },
                )
                update_job(
                    job_id,
                    status="queued",
                    stage="Upload",
                    message=f"Retry {next_attempt}/{max_retries} after error: {exc}",
                )
                retry_payload = dict(payload)
                retry_payload["attempt"] = next_attempt
                # Fresh enqueue timestamp for wait metrics on retry
                retry_payload.pop("enqueued_at", None)
                enqueue_job(retry_payload)
            else:
                logger.error(
                    "worker job failed permanently",
                    extra={
                        "event": "worker_failed",
                        "job_id": job_id,
                        "attempt": attempt,
                        "error_type": type(exc).__name__,
                        "duration_ms": round(elapsed * 1000, 2),
                    },
                )
                fail_job(job_id, exc)
                observe_worker_job("failed", elapsed)
        finally:
            # Keep file for retries; delete only when terminal or file gone
            job_after = get_job(job_id, refresh=True) or {}
            status = job_after.get("status")
            if status in ("Completed", "Failed") and video_path and os.path.isfile(video_path):
                try:
                    os.remove(video_path)
                except OSError:
                    pass
    finally:
        reset_job_id(token)
