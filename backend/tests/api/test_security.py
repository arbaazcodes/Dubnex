"""Security gate tests.

Unauthenticated requests to paid / resource-heavy endpoints must be rejected
(401) before any processing. Authenticated SSE /events/{job_id} is restricted
to the job owner.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import app as app_module

_MINI_MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64
_MINI_MP3 = b"ID3" + b"\x00" * 32


# (method, path, kwargs) — every request is sent WITHOUT an auth token.
UNAUTHENTICATED_ENDPOINTS = [
    ("post", "/api/chat", {"json": {"message": "hi"}}),
    (
        "post",
        "/api/translate",
        {"json": {"text": "hi", "source_lang": "en", "target_lang": "fr"}},
    ),
    (
        "post",
        "/translate",
        {"params": {"text": "hi", "source_lang": "en", "target_lang": "fr"}},
    ),
    ("get", "/voices", {}),
    ("get", "/eleven-test", {}),
    ("post", "/process-video", {"files": {"file": ("clip.mp4", _MINI_MP4)}}),
    ("post", "/detect-language", {"files": {"file": ("a.mp3", _MINI_MP3)}}),
    ("post", "/detect-video-language", {"files": {"file": ("b.mp4", _MINI_MP4)}}),
    ("post", "/transcribe-video", {"files": {"file": ("c.mp4", _MINI_MP4)}}),
    (
        "post",
        "/render-video",
        {"files": {"video": ("v.mp4", _MINI_MP4), "audio": ("a.mp3", _MINI_MP3)}},
    ),
    # -- formerly unauthenticated endpoints now gated --
    ("post", "/job", {}),
    ("get", "/job/some-job-id", {}),
    ("post", "/api/detect-language", {"json": {"filename": "clip.mp4"}}),
    ("post", "/api/transcribe-audio", {"json": {"audio": "bGVsbG8="}}),
    ("post", "/api/analyze-video", {"json": {"title": "Active Video"}}),
    ("get", "/api/pipeline-sse", {"params": {"jobId": "abc"}}),
    ("get", "/metrics", {}),
    ("get", "/health/detailed", {}),
]


@pytest.mark.parametrize(
    ("method", "path", "kwargs"),
    UNAUTHENTICATED_ENDPOINTS,
    ids=[p for _, p, _ in UNAUTHENTICATED_ENDPOINTS],
)
def test_paid_endpoint_requires_auth(method, path, kwargs):
    with TestClient(app_module.app) as client:
        res = getattr(client, method)(path, **kwargs)
    assert res.status_code == 401, f"{method.upper()} {path} should be protected"


def test_events_requires_auth():
    with TestClient(app_module.app) as client:
        res = client.get("/events/does-not-matter")
    assert res.status_code == 401


def test_events_forbidden_for_other_owner(authed_client):
    from services.job_service import create_job, fail_job

    job_id = create_job(title="someone-elses", owner_id="user-other")
    fail_job(job_id, RuntimeError("done"))
    res = authed_client.get(f"/events/{job_id}")
    assert res.status_code == 403


def test_events_allows_owner(authed_client):
    from services.job_service import create_job, fail_job

    job_id = create_job(title="mine", owner_id="user-test-1")
    fail_job(job_id, RuntimeError("done"))
    res = authed_client.get(f"/events/{job_id}")
    assert res.status_code == 200
    assert "event-stream" in res.headers.get("content-type", "")
    assert "Failed" in res.text


def test_events_unknown_job_404(authed_client):
    res = authed_client.get("/events/nonexistent-job-xyz")
    assert res.status_code == 404


# --- /job detail: authenticated + owner-only (IDOR guard) ---


def test_job_detail_forbidden_for_other_owner(authed_client):
    from services.job_service import create_job, fail_job

    job_id = create_job(title="someone-elses", owner_id="user-other")
    fail_job(job_id, RuntimeError("done"))
    res = authed_client.get(f"/job/{job_id}")
    assert res.status_code == 403


def test_job_detail_allows_owner(authed_client):
    from services.job_service import create_job, fail_job

    job_id = create_job(title="mine", owner_id="user-test-1")
    fail_job(job_id, RuntimeError("done"))
    res = authed_client.get(f"/job/{job_id}")
    assert res.status_code == 200
    assert res.json().get("id") == job_id


def test_job_detail_unknown_404(authed_client):
    res = authed_client.get("/job/nonexistent-job-xyz")
    assert res.status_code == 404


# --- /metrics: static METRICS_TOKEN bearer or Firebase auth ---


def test_metrics_accepts_metrics_token(monkeypatch):
    monkeypatch.setattr(app_module, "METRICS_TOKEN", "prom-scrape-token")
    with TestClient(app_module.app) as client:
        res = client.get(
            "/metrics", headers={"Authorization": "Bearer prom-scrape-token"}
        )
    assert res.status_code == 200


def test_metrics_rejects_wrong_token(monkeypatch):
    import services.firebase_auth as fa
    from fastapi import HTTPException

    monkeypatch.setattr(app_module, "METRICS_TOKEN", "prom-scrape-token")
    monkeypatch.setattr(
        fa,
        "verify_firebase_id_token",
        lambda token: (_ for _ in ()).throw(HTTPException(status_code=401)),
    )
    with TestClient(app_module.app) as client:
        res = client.get(
            "/metrics", headers={"Authorization": "Bearer nope"}
        )
    assert res.status_code == 401


# --- baseline security response headers ---


def test_security_headers_present():
    with TestClient(app_module.app) as client:
        res = client.get("/health")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert res.headers.get("x-dns-prefetch-control") == "off"


def test_security_headers_do_not_override_existing():
    # FileResponse / explicit handlers may set stricter values — middleware must not clobber.
    with TestClient(app_module.app) as client:
        res = client.get("/health")
    assert res.headers.get("content-type", "").startswith("application/json")


# --- upload / input caps ---


def test_render_video_oversize_rejected(authed_client, monkeypatch):
    monkeypatch.setattr(app_module, "MAX_RENDER_UPLOAD_BYTES", 32)
    res = authed_client.post(
        "/render-video",
        files={
            "video": ("big.mp4", b"\x00" * 4096),
            "audio": ("a.mp3", b"ID3" + b"\x00" * 32),
        },
    )
    assert res.status_code == 413


def test_render_video_bad_extension_rejected(authed_client):
    res = authed_client.post(
        "/render-video",
        files={
            "video": ("payload.txt", b"hello"),
            "audio": ("a.mp3", b"ID3" + b"\x00" * 32),
        },
    )
    assert res.status_code == 400


def test_process_video_invalid_voice_rejected(authed_client):
    res = authed_client.post(
        "/process-video",
        params={"voice": "../evil", "target_lang": "en"},
        files={"file": ("clip.mp4", _MINI_MP4)},
    )
    assert res.status_code == 400


def test_process_video_invalid_target_lang_rejected(authed_client):
    res = authed_client.post(
        "/process-video",
        params={"voice": "george", "target_lang": "../../etc/passwd"},
        files={"file": ("clip.mp4", _MINI_MP4)},
    )
    assert res.status_code == 400


def test_chat_oversize_message_rejected(authed_client):
    res = authed_client.post(
        "/api/chat",
        json={"message": "x" * (app_module.MAX_CHAT_MESSAGE_LENGTH + 1)},
    )
    assert res.status_code == 400


def test_transcribe_oversize_payload_rejected(authed_client):
    res = authed_client.post(
        "/api/transcribe-audio",
        json={"audio": "a" * (app_module.MAX_TRANSCRIBE_PAYLOAD_BYTES + 1)},
    )
    assert res.status_code == 400


# --- endpoint-level rate limiting on a formerly-public route ---


def test_detect_language_rate_limited(authed_client, monkeypatch):
    import config as app_config

    monkeypatch.setattr(app_config, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_USER", 2)
    monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_IP", 100)
    for _ in range(2):
        res = authed_client.post(
            "/api/detect-language", json={"filename": "clip.mp4"}
        )
        assert res.status_code == 200
    res = authed_client.post("/api/detect-language", json={"filename": "clip.mp4"})
    assert res.status_code == 429


# --- WebSocket auth ---


def test_websocket_requires_token():
    with TestClient(app_module.app) as client:
        with pytest.raises(WebSocketDisconnect) as excinfo:
            with client.websocket_connect("/live") as ws:
                ws.receive_text()
    assert excinfo.value.code == 4401


def test_websocket_allows_valid_token(monkeypatch):
    from services.firebase_auth import AuthenticatedUser

    monkeypatch.setattr(
        app_module,
        "verify_firebase_id_token",
        lambda token: AuthenticatedUser(uid="user-test-1"),
    )
    with TestClient(app_module.app) as client:
        with client.websocket_connect("/live?token=valid-token") as ws:
            ws.send_text("hello")
            data = ws.receive_text()
    assert "live socket placeholder" in data
