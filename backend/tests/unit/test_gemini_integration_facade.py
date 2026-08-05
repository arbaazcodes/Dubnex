"""Integration-style: translator facade routes to Gemini when configured (mocked)."""

from __future__ import annotations

import json

import httpx
import pytest


def test_translator_uses_gemini_when_provider_gemini(monkeypatch):
    import services.gemini_service as gs
    import services.translator_service as ts

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 0)
    monkeypatch.setattr(gs, "GEMINI_BACKOFF_JITTER_RATIO", 0.0)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {"translated_text": "hola"}
                                    )
                                }
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
    assert ts.resolve_translation_provider() == "gemini"
    assert ts.translate_text("hello", "en", "es") == "hola"


def test_pipeline_cleanup_optional(monkeypatch):
    """cleanup_transcript preserves segment timing."""
    import services.gemini_service as gs

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
                                {
                                    "text": json.dumps(
                                        {
                                            "full_text": "Hello world.",
                                            "segments": [
                                                {"id": 0, "text": "Hello world."}
                                            ],
                                        }
                                    )
                                }
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
    result = {
        "full_text": "hello world",
        "language": "en",
        "segments": [
            {"id": 0, "start": 0.0, "end": 1.2, "duration": 1.2, "text": "hello world"}
        ],
    }
    cleaned = gs.cleanup_transcript(result)
    assert cleaned["segments"][0]["start"] == 0.0
    assert cleaned["segments"][0]["text"] == "Hello world."
