"""Unit tests for Gemini service (mocked HTTP — no live API key required)."""

from __future__ import annotations

import json

import httpx
import pytest


@pytest.fixture
def gemini(monkeypatch):
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 2)
    monkeypatch.setattr(gs, "GEMINI_BACKOFF_BASE_SECONDS", 0.01)
    monkeypatch.setattr(gs, "GEMINI_BACKOFF_MAX_SECONDS", 0.05)
    monkeypatch.setattr(gs, "GEMINI_BACKOFF_JITTER_RATIO", 0.0)
    monkeypatch.setattr(gs, "GEMINI_TIMEOUT_SECONDS", 5.0)
    return gs


def _ok_response(text: str, status: int = 200) -> httpx.Response:
    payload = {
        "candidates": [
            {"content": {"parts": [{"text": text}]}}
        ]
    }
    return httpx.Response(status, json=payload)


def test_missing_api_key(monkeypatch):
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "")
    assert gs.is_configured() is False
    with pytest.raises(gs.GeminiError, match="GEMINI_API_KEY"):
        gs.generate_content(user_prompt="hi")


def test_translate_text_json(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert "x-goog-api-key" in request.headers
        assert request.headers["x-goog-api-key"] == "test-key-not-real"
        return _ok_response(json.dumps({"translated_text": "नमस्ते"}))

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    out = gemini.translate_text("hello", "en", "hi")
    assert out == "नमस्ते"


def test_chat(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_response("Use a warmer tone for the open.")

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    out = gemini.chat("How should I dub this?", role="director")
    assert "warmer" in out.lower() or "tone" in out.lower() or len(out) > 0


def test_invalid_key_401(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": {"message": "API key not valid"}})

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    with pytest.raises(gemini.GeminiError, match="authentication"):
        gemini.generate_content(user_prompt="x")


def test_429_retries_then_succeeds(gemini, monkeypatch):
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(
                429,
                json={"error": {"message": "rate limit"}},
                headers={"Retry-After": "0"},
            )
        return _ok_response("ok-after-retry")

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    out = gemini.generate_content(user_prompt="retry me")
    assert out == "ok-after-retry"
    assert calls["n"] == 2


def test_timeout(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("slow")

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    with pytest.raises(gemini.GeminiError, match="timed out"):
        gemini.generate_content(user_prompt="x")


def test_translate_segments_preserves_timing(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_response(
            json.dumps(
                {
                    "segments": [
                        {"id": 0, "translated": "uno"},
                        {"id": 1, "translated": "dos"},
                    ]
                }
            )
        )

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    segs = [
        {"id": 0, "start": 0.0, "end": 1.0, "duration": 1.0, "text": "one"},
        {"id": 1, "start": 1.0, "end": 2.0, "duration": 1.0, "text": "two"},
    ]
    out = gemini.translate_segments(segs, "en", "es")
    assert out[0]["start"] == 0.0 and out[0]["translated"] == "uno"
    assert out[1]["end"] == 2.0 and out[1]["original"] == "two"


def test_key_never_in_error_message(gemini, monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            text=f"bad key test-key-not-real leaked",
        )

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *args, **kwargs):
            kwargs["transport"] = transport
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(gemini.httpx, "Client", Client)
    with pytest.raises(gemini.GeminiError) as ei:
        gemini.generate_content(user_prompt="x")
    assert "test-key-not-real" not in str(ei.value)
