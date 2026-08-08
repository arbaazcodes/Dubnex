"""
API tests for OpenAI-backed endpoints (mocked). Verifies provider routing,
the preserved /api/chat contract, and the new analysis/improvement endpoints.
"""

from __future__ import annotations

import json

import httpx
import pytest


def _force_openai_provider(monkeypatch):
    """Point AI_PROVIDER resolution at OpenAI and fake its client."""
    import services.ai_provider as ap
    import services.openai_service as os_

    monkeypatch.setattr(ap, "OPENAI_API_KEY", "test-key")
    os_._import_sdk()
    monkeypatch.setattr(os_, "OPENAI_API_KEY", "test-key")
    monkeypatch.setattr(os_, "OPENAI_MAX_RETRIES", 0)
    os_.reset_client()

    class _Msg:
        content = ""

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    def _fake_response(text: str):
        _Msg.content = text
        return _Resp()

    class FakeCompletions:
        def create(self, **kwargs):
            return _fake_response(kwargs.get("_text", "openai reply"))

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()
    return os_


def test_chat_routes_to_openai(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)

    # Make the fake return a fixed text.
    class _Msg:
        content = "hello from openai"

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post("/api/chat", json={"message": "hi", "role": "director"})
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "openai"
    assert "hello from openai" in body["text"]


def test_chat_gemini_fallback_when_openai_missing_key(authed_client, monkeypatch):
    """When neither key is set, chat returns 503 (Gemini path, provider=gemini)."""
    import services.ai_provider as ap

    monkeypatch.setattr(ap, "OPENAI_API_KEY", "")
    res = authed_client.post("/api/chat", json={"message": "hi"})
    assert res.status_code == 503


def test_analyze_video_routes_to_openai(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)
    sent = {}

    class _Msg:
        content = json.dumps(
            {
                "analysis": "### Overview\nA tour.",
                "summary": "A short tour.",
                "title": "Tour",
                "description": "Guided tour.",
            }
        )

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            sent["prompt"] = kwargs["messages"][-1]["content"]
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post(
        "/api/analyze-video",
        json={"title": "Clip", "transcript": [{"id": "0", "text": "hello"}], "query": "what?"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "openai"
    assert body["title"] == "Tour"
    assert "hello" in sent["prompt"]


def test_analyze_transcript_ok(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)

    class _Msg:
        content = json.dumps(
            {
                "topic": "Mic setup",
                "tone": "instructional",
                "speaking_style": "direct",
                "audience": "beginners",
                "key_points": ["connect mic"],
                "unclear_sections": [],
                "quality": "good",
                "translation_risks": [],
            }
        )

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post(
        "/api/analyze-transcript", json={"transcript": "Connect the mic."}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "openai"
    assert body["topic"] == "Mic setup"
    assert body["key_points"] == ["connect mic"]


def test_analyze_transcript_requires_transcript(authed_client):
    res = authed_client.post("/api/analyze-transcript", json={})
    assert res.status_code == 400


def test_improve_transcript_ok(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)

    class _Msg:
        content = json.dumps({"improved_text": "Hello, world!"})

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post(
        "/api/improve-transcript", json={"transcript": "hello world"}
    )
    assert res.status_code == 200
    assert res.json()["improved_text"] == "Hello, world!"


def test_improve_translation_ok(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)

    class _Msg:
        content = json.dumps(
            {
                "segments": [
                    {"id": 0, "improved_translation": "¡Hola!", "note": "Naturalized."}
                ]
            }
        )

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post(
        "/api/improve-translation",
        json={"segments": [{"id": 0, "original": "hello", "translated": "hola"}]},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["segments"][0]["improved_translation"] == "¡Hola!"


def test_improve_translation_requires_segments(authed_client):
    res = authed_client.post("/api/improve-translation", json={})
    assert res.status_code == 400


def test_recommend_voice_routes_to_openai(authed_client, monkeypatch):
    os_ = _force_openai_provider(monkeypatch)

    class _Msg:
        content = json.dumps(
            {"recommended_voice_id": "bunty", "reason": "fits", "confidence": 0.8}
        )

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class FakeCompletions:
        def create(self, **kwargs):
            return _Resp()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()

    res = authed_client.post(
        "/api/recommend-voice", json={"transcript": "A friendly chat.", "target_language": "hi"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["recommended_voice_id"] == "bunty"
    assert body["provider"] == "openai"
    assert "bunty" in body["available_voice_ids"]


def test_analyze_transcript_missing_key_503(authed_client, monkeypatch):
    """With AI_PROVIDER=openai and no OpenAI key, return 503."""
    import services.ai_provider as ap
    import services.openai_service as os_

    monkeypatch.setattr(ap, "AI_PROVIDER", "openai")
    monkeypatch.setattr(os_, "OPENAI_API_KEY", "")
    res = authed_client.post(
        "/api/analyze-transcript", json={"transcript": "hello"}
    )
    assert res.status_code == 503
    assert "OPENAI_API_KEY" in res.json()["error"]
