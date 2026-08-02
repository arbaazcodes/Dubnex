"""Failure-mode tests."""

from __future__ import annotations

import pytest
from unittest.mock import MagicMock


def test_invalid_file_type(authed_client):
    res = authed_client.post(
        "/process-video?target_lang=en",
        files={"file": ("notes.txt", b"hello", "text/plain")},
        headers={"Authorization": "Bearer t"},
    )
    assert res.status_code == 400
    assert "Unsupported" in res.json().get("error", "")


def test_empty_upload(authed_client):
    res = authed_client.post(
        "/process-video?target_lang=en",
        files={"file": ("empty.mp4", b"", "video/mp4")},
        headers={"Authorization": "Bearer t"},
    )
    assert res.status_code == 400


def test_missing_redis_falls_back_or_errors(monkeypatch):
    import services.queue_service as qs

    monkeypatch.setattr(qs, "QUEUE_BACKEND", "redis")
    monkeypatch.setattr(qs, "REDIS_URL", "")
    qs._redis = None
    with pytest.raises(RuntimeError, match="REDIS_URL"):
        qs.get_redis()


def test_missing_db_check_reports_failure(monkeypatch):
    from services.health_service import _check_database

    monkeypatch.setattr(
        "services.db.get_engine",
        MagicMock(side_effect=RuntimeError("db down")),
    )
    result = _check_database()
    assert result["ok"] is False


def test_missing_storage_s3_bucket(monkeypatch):
    from services.health_service import _check_storage
    import services.storage_service as ss

    class Boom:
        name = "s3"
        bucket = ""

        def __init__(self):
            raise RuntimeError("S3_BUCKET is required")

    monkeypatch.setattr(ss, "get_storage", MagicMock(side_effect=RuntimeError("S3_BUCKET is required")))
    result = _check_storage()
    assert result["ok"] is False


def test_worker_crash_retries_then_fails(monkeypatch, tmp_path):
    from services.job_service import create_job, get_job
    from services.job_runner import process_queued_job
    from services.queue_service import set_inline_handler, enqueue_job
    import services.job_runner as jr

    calls = {"n": 0}

    async def boom(*args, **kwargs):
        calls["n"] += 1
        raise RuntimeError("worker crash")

    monkeypatch.setattr(jr, "process_video", boom)
    monkeypatch.setattr(jr, "should_retry", lambda attempt, max_retries=None: attempt <= 1)

    # Avoid real re-enqueue loop explosion: only allow one retry then fail
    enqueues = []

    def capture_enqueue(payload):
        enqueues.append(dict(payload))
        # Do not recursively process
        return {"backend": "inline"}

    monkeypatch.setattr(jr, "enqueue_job", capture_enqueue)

    video = tmp_path / "v.mp4"
    video.write_bytes(b"data")
    jid = create_job(title="crash", owner_id="u1")
    process_queued_job(
        {
            "job_id": jid,
            "video_path": str(video),
            "target_language": "en",
            "voice": "george",
            "attempt": 0,
            "max_retries": 1,
        }
    )
    # First failure should schedule retry via enqueue_job
    assert len(enqueues) == 1
    assert enqueues[0]["attempt"] == 1

    # Exhaust retries
    process_queued_job({**enqueues[0], "video_path": str(video)})
    job = get_job(jid, refresh=True)
    assert job["status"] == "Failed"
