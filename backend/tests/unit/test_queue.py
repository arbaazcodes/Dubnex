"""Unit tests for Redis/inline queue."""

import json
from unittest.mock import MagicMock

import pytest


def test_resolve_backend_inline(monkeypatch):
    import services.queue_service as qs

    monkeypatch.setattr(qs, "QUEUE_BACKEND", "auto")
    monkeypatch.setattr(qs, "REDIS_URL", "")
    assert qs.resolve_backend() == "inline"
    monkeypatch.setattr(qs, "QUEUE_BACKEND", "redis")
    monkeypatch.setattr(qs, "REDIS_URL", "redis://localhost:6379/0")
    assert qs.resolve_backend() == "redis"


def test_should_retry_policy():
    from services.queue_service import should_retry

    assert should_retry(1, 2) is True
    assert should_retry(2, 2) is True
    assert should_retry(3, 2) is False


def test_inline_enqueue(monkeypatch):
    import services.queue_service as qs

    monkeypatch.setattr(qs, "QUEUE_BACKEND", "inline")
    monkeypatch.setattr(qs, "REDIS_URL", "")
    seen = {}

    def handler(payload):
        seen["job_id"] = payload["job_id"]

    qs.set_inline_handler(handler)
    meta = qs.enqueue_job({"job_id": "j1", "video_path": "/x", "target_language": "en", "voice": "george"})
    assert meta["backend"] == "inline"
    # Inline runs in thread — brief wait
    import time

    for _ in range(50):
        if seen.get("job_id") == "j1":
            break
        time.sleep(0.02)
    assert seen.get("job_id") == "j1"


def test_redis_enqueue_dequeue(monkeypatch):
    import services.queue_service as qs

    fake = MagicMock()
    store = []

    def lpush(key, raw):
        store.append(raw)
        return 1

    def brpop(key, timeout=0):
        if not store:
            return None
        return (key, store.pop())

    fake.lpush = lpush
    fake.brpop = brpop
    fake.ping = MagicMock(return_value=True)

    monkeypatch.setattr(qs, "QUEUE_BACKEND", "redis")
    monkeypatch.setattr(qs, "REDIS_URL", "redis://fake")
    monkeypatch.setattr(qs, "_redis", fake)
    monkeypatch.setattr(qs, "get_redis", lambda: fake)

    qs.enqueue_job({"job_id": "r1", "video_path": "/v", "target_language": "hi", "voice": "george"})
    payload = qs.dequeue_job(timeout=1)
    assert payload["job_id"] == "r1"
    assert "enqueued_at" in payload
