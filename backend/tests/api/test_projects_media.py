"""API tests: auth gate, projects, download/stream."""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def test_health():
    from fastapi.testclient import TestClient
    import app as app_module
    from unittest.mock import MagicMock
    import app as am

    # Avoid full lifespan model checks if any
    with TestClient(app_module.app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


def test_projects_requires_auth():
    from fastapi.testclient import TestClient
    import app as app_module

    with TestClient(app_module.app) as client:
        r = client.get("/api/projects")
        assert r.status_code == 401


def test_login_token_path(authed_client, monkeypatch):
    """Simulated login: bearer token accepted via auth bypass fixture → list OK."""
    r = authed_client.get("/api/projects", headers={"Authorization": "Bearer fake"})
    assert r.status_code == 200
    assert "projects" in r.json()


def test_project_detail_and_delete(authed_client, auth_user):
    from services.job_service import create_job, finish_job

    jid = create_job(title="API Proj", owner_id=auth_user.uid)
    finish_job(jid, {"output_video": "", "segments": [], "voice": "george", "language": "en"})

    r = authed_client.get(f"/api/projects/{jid}", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200
    assert r.json()["id"] == jid

    d = authed_client.delete(f"/api/projects/{jid}", headers={"Authorization": "Bearer t"})
    assert d.status_code == 200


def test_stream_and_download(authed_client, auth_user, tmp_path, monkeypatch):
    from services.job_service import create_job, finish_job, jobs
    from services.output_registry import register_project_output
    import config

    out_dir = Path(config.OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = "api_media_test.mp4"
    media = out_dir / filename
    media.write_bytes(b"0" * 2048)

    jid = create_job(title="Media", owner_id=auth_user.uid)
    # Register as if pipeline finished
    register_project_output(
        project_id=jid,
        filename=filename,
        owner_id=auth_user.uid,
        status="Completed",
        storage_provider="local",
        storage_key=filename,
    )
    job = jobs[jid]
    job["status"] = "Completed"
    job["output_filename"] = filename
    job["storage_key"] = filename
    job["storage_provider"] = "local"
    job["owner_id"] = auth_user.uid

    video = authed_client.get(
        f"/api/projects/{jid}/video",
        headers={"Authorization": "Bearer t"},
    )
    assert video.status_code == 200
    assert video.headers.get("content-type", "").startswith("video/")

    dl = authed_client.get(
        f"/api/projects/{jid}/download",
        headers={"Authorization": "Bearer t"},
    )
    assert dl.status_code == 200
