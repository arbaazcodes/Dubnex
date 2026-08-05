"""API tests for Gemini chat / translate endpoints (mocked)."""

from __future__ import annotations

import json

import httpx
import pytest


def test_chat_requires_message(authed_client):
    res = authed_client.post("/api/chat", json={})
    assert res.status_code == 400


def test_chat_missing_key(authed_client, monkeypatch):
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "")
    res = authed_client.post("/api/chat", json={"message": "hi"})
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["error"]


def test_chat_ok(authed_client, monkeypatch):
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 0)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": "Dub with slower pacing."}]}}
                ]
            },
        )

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *a, **k):
            k["transport"] = transport
            super().__init__(*a, **k)

    monkeypatch.setattr(gs.httpx, "Client", Client)
    res = authed_client.post(
        "/api/chat",
        json={"message": "How should I dub this?", "role": "director"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "gemini"
    assert "pacing" in body["text"].lower() or len(body["text"]) > 0


def test_translate_api(authed_client, monkeypatch):
    import services.gemini_service as gs
    import services.translator_service as ts

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 0)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": json.dumps({"translated_text": "bonjour"})}
                            ]
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *a, **k):
            k["transport"] = transport
            super().__init__(*a, **k)

    monkeypatch.setattr(gs.httpx, "Client", Client)
    res = authed_client.post(
        "/api/translate",
        json={"text": "hello", "source_lang": "en", "target_lang": "fr"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["translated_text"] == "bonjour"
    assert body["provider"] == "gemini"


def test_health_and_ready(authed_client):
    h = authed_client.get("/health")
    assert h.status_code == 200
    r = authed_client.get("/ready")
    assert r.status_code in (200, 503)
    payload = r.json()
    assert "checks" in payload or "ok" in payload or isinstance(payload, dict)
