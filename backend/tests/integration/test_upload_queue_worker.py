"""Integration: upload → queue → worker → DB/storage."""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def fake_pipeline(monkeypatch, tmp_path):
    out = tmp_path / "out.mp4"
    out.write_bytes(b"mp4-bytes")

    async def _process_video(video_path, target_language, voice="george", on_progress=None):
        if on_progress:
            on_progress("Whisper", "ok")
            on_progress("Translation", "ok")
            on_progress("TTS", "ok")
        return {
            "success": True,
            "language": "en",
            "original_text": "hello",
            "translated_text": "namaste",
            "segments": [
                {
                    "id": 0,
                    "start": 0,
                    "end": 1,
                    "original": "hello",
                    "translated": "namaste",
                }
            ],
            "voice": voice,
            "output_video": str(out),
        }

    monkeypatch.setattr(
        "services.job_runner.process_video",
        _process_video,
    )
    return out


def test_upload_enqueue_worker_db(authed_client, sample_mp4, fake_pipeline, auth_user):
    from services.job_service import get_job
    from services.project_repository import get_project
    import time

    with open(sample_mp4, "rb") as f:
        res = authed_client.post(
            "/process-video?target_lang=hi&voice=george",
            files={"file": ("clip.mp4", f, "video/mp4")},
            headers={"Authorization": "Bearer test-token"},
        )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "queued"
    job_id = body["job_id"]

    # Inline worker should finish quickly with fake pipeline
    for _ in range(100):
        job = get_job(job_id, refresh=True)
        if job and job.get("status") == "Completed":
            break
        time.sleep(0.05)
    else:
        pytest.fail(f"job did not complete: {get_job(job_id)}")

    stored = get_project(job_id)
    assert stored is not None
    assert stored.get("owner_id") == auth_user.uid
    assert stored.get("status") == "Completed"


def test_database_list_projects(authed_client, auth_user):
    from services.job_service import create_job, finish_job

    jid = create_job(title="DB Proj", owner_id=auth_user.uid, voice="george")
    finish_job(
        jid,
        {
            "output_video": "",
            "segments": [],
            "voice": "george",
            "language": "en",
        },
    )
    res = authed_client.get("/api/projects", headers={"Authorization": "Bearer t"})
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()["projects"]]
    assert jid in ids


def test_storage_persist_integration(tmp_path, monkeypatch):
    from services.storage_service import LocalStorageBackend

    root = tmp_path / "out"
    root.mkdir()
    src = tmp_path / "a.mp4"
    src.write_bytes(b"xyz")
    be = LocalStorageBackend(root=str(root))
    key = be.upload_file(str(src), "a.mp4")
    assert (root / "a.mp4").read_bytes() == b"xyz"
    assert be.exists(key)
