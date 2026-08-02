"""
Redis-backed job queue for dubbing / render work.

API enqueues payloads; a separate worker process dequeues and runs process_video().
Falls back to an in-process handler when QUEUE_BACKEND=inline or Redis is unavailable.
"""

from __future__ import annotations

import json
import os
import threading
from typing import Any, Callable

from config import (
    JOB_MAX_RETRIES,
    QUEUE_BACKEND,
    QUEUE_BRPOP_TIMEOUT,
    QUEUE_NAME,
    REDIS_URL,
)
from services.logging_service import get_logger

logger = get_logger("screen_ai.queue")

_redis = None
_inline_handler: Callable[[dict[str, Any]], None] | None = None
_inline_lock = threading.Lock()


def resolve_backend() -> str:
    mode = QUEUE_BACKEND
    if mode == "auto":
        return "redis" if REDIS_URL else "inline"
    if mode in ("redis", "inline"):
        return mode
    return "redis" if REDIS_URL else "inline"


def get_redis():
    global _redis
    if _redis is not None:
        return _redis
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is not configured")
    import redis

    _redis = redis.from_url(REDIS_URL, decode_responses=True)
    _redis.ping()
    return _redis


def set_inline_handler(handler: Callable[[dict[str, Any]], None] | None) -> None:
    """Used by the API process for local/dev inline execution."""
    global _inline_handler
    _inline_handler = handler


def enqueue_job(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Enqueue a job payload.
    Expected keys: job_id, video_path, target_language, voice, attempt (optional).
    """
    from datetime import datetime, timezone

    body = dict(payload)
    body.setdefault("attempt", 0)
    body.setdefault("max_retries", JOB_MAX_RETRIES)
    body.setdefault("enqueued_at", datetime.now(timezone.utc).isoformat())
    backend = resolve_backend()

    if backend == "redis":
        client = get_redis()
        client.lpush(QUEUE_NAME, json.dumps(body))
        logger.info(
            "job enqueued",
            extra={
                "event": "queue_enqueue",
                "job_id": body.get("job_id"),
                "attempt": body.get("attempt"),
            },
        )
        return {"backend": "redis", "queue": QUEUE_NAME, **{k: body[k] for k in ("job_id", "attempt")}}

    # Inline: run asynchronously in a daemon thread (dev fallback)
    handler = _inline_handler
    if handler is None:
        raise RuntimeError("Inline queue handler is not registered")

    def _run():
        try:
            handler(body)
        except Exception as exc:
            logger.exception(
                "inline queue handler failed: %s",
                exc,
                extra={"event": "queue_inline_error", "job_id": body.get("job_id")},
            )

    threading.Thread(target=_run, daemon=True, name=f"job-{body.get('job_id', 'x')[:8]}").start()
    logger.info(
        "job enqueued inline",
        extra={"event": "queue_enqueue_inline", "job_id": body.get("job_id")},
    )
    return {"backend": "inline", "job_id": body.get("job_id"), "attempt": body.get("attempt")}


def dequeue_job(timeout: int | None = None) -> dict[str, Any] | None:
    """Blocking pop from Redis. Returns None on timeout."""
    client = get_redis()
    wait = QUEUE_BRPOP_TIMEOUT if timeout is None else timeout
    item = client.brpop(QUEUE_NAME, timeout=wait)
    if not item:
        return None
    _key, raw = item
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("invalid queue payload", extra={"event": "queue_bad_payload"})
        return None


def queue_depth() -> int | None:
    backend = resolve_backend()
    if backend != "redis":
        return None
    try:
        return int(get_redis().llen(QUEUE_NAME))
    except Exception:
        return None


def should_retry(attempt: int, max_retries: int | None = None) -> bool:
    """
    attempt = number of the upcoming retry (1..max_retries).
    Returns True if that retry is still allowed.
    """
    limit = JOB_MAX_RETRIES if max_retries is None else max_retries
    return attempt <= limit
