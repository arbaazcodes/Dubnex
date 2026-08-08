"""Tests for the real /api/transcribe-audio endpoint (base64 mic audio -> Whisper)."""

import base64


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def test_transcribe_valid_audio(authed_client):
    resp = authed_client.post(
        "/api/transcribe-audio",
        json={"audio": _b64(b"\x1a\x45\xdf\xa3fakewebm"), "mimeType": "audio/webm"},
    )
    assert resp.status_code == 200
    data = resp.json()
    # conftest stubs whisper.transcribe_audio with a fixed result.
    assert data["text"] == "hello world"
    assert data["language"] == "en"
    assert data["confidence"] == 0.99
    assert data["segments"] and data["segments"][0]["text"] == "hello world"


def test_transcribe_invalid_base64(authed_client):
    resp = authed_client.post(
        "/api/transcribe-audio",
        json={"audio": "!!!not-base64!!!", "mimeType": "audio/webm"},
    )
    assert resp.status_code == 400
    assert "base64" in resp.json()["error"]


def test_transcribe_empty_string(authed_client):
    # Empty string audio is rejected up front (valid base64 that decodes to
    # zero bytes cannot exist, so the "empty after decode" branch is unreachable).
    resp = authed_client.post(
        "/api/transcribe-audio", json={"audio": ""}
    )
    assert resp.status_code == 400


def test_transcribe_missing_audio_field(authed_client):
    resp = authed_client.post("/api/transcribe-audio", json={})
    assert resp.status_code == 400
    assert "required" in resp.json()["error"].lower()


def test_transcribe_oversized_payload(authed_client):
    big = _b64(b"x" * (8 * 1024 * 1024))
    resp = authed_client.post("/api/transcribe-audio", json={"audio": big})
    assert resp.status_code == 400
    assert "too large" in resp.json()["error"].lower()


def test_transcribe_whisper_failure_returns_500(authed_client, monkeypatch):
    import app as app_module

    def boom(_path):
        raise RuntimeError("whisper crashed")

    monkeypatch.setattr(app_module, "transcribe_audio", boom)
    resp = authed_client.post(
        "/api/transcribe-audio",
        json={"audio": _b64(b"\x00fake"), "mimeType": "audio/webm"},
    )
    assert resp.status_code == 500
    assert "Transcription failed" in resp.json()["error"]


def test_transcribe_audio_payload_helper_decodes_and_cleans_up(monkeypatch):
    """Unit-level: the helper runs whisper on a temp file and removes it."""
    import asyncio
    import os

    import app as app_module

    created_paths = []

    def fake_transcribe(audio_path):
        created_paths.append(audio_path)
        return {
            "language": "hi",
            "confidence": 0.91,
            "full_text": "नमस्ते",
            "segments": [
                {"id": 0, "start": 0.0, "end": 1.2, "duration": 1.2, "text": "नमस्ते"}
            ],
        }

    monkeypatch.setattr(app_module, "transcribe_audio", fake_transcribe)
    out = asyncio.run(
        app_module.transcribe_audio_payload(
            base64.b64encode(b"webm-bytes").decode()
        )
    )
    assert out["text"] == "नमस्ते"
    assert out["language"] == "hi"
    assert len(out["segments"]) == 1
    assert created_paths, "whisper should have received a temp file"
    assert not os.path.exists(created_paths[0]), "temp file should be cleaned up"
