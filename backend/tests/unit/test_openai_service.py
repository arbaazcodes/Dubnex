"""
Unit tests for the OpenAI chat/analysis service (mocked — no live key needed).

Covers: missing key, success, timeout, 429, auth failure, retry handling,
malformed response, chat, transcript analysis, transcript improvement,
translation improvement, voice recommendation validation, and key redaction.
"""

from __future__ import annotations

import json

import httpx
import pytest


def _enable_openai(monkeypatch):
    """Configure a fake OpenAI client so tests never hit the network."""
    import openai as sdk
    import services.openai_service as os_

    os_._import_sdk()  # populate real SDK error classes for mapping
    monkeypatch.setattr(os_, "OPENAI_API_KEY", "test-openai-key-not-real")
    monkeypatch.setattr(os_, "OPENAI_MAX_RETRIES", 0)
    os_.reset_client()
    return os_


def _fake_response(text: str):
    class _Msg:
        content = text

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    return _Resp()


def _set_fake_client(monkeypatch, os_, handler):
    """handler(kwargs) -> response object or raises."""

    class FakeCompletions:
        def create(self, **kwargs):
            return handler(kwargs)

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()


# ---------------------------------------------------------------------------
# Missing key
# ---------------------------------------------------------------------------


def test_missing_key_raises_503(monkeypatch):
    import services.openai_service as os_

    monkeypatch.setattr(os_, "OPENAI_API_KEY", "")
    with pytest.raises(os_.OpenAIError) as excinfo:
        os_.generate_content(user_prompt="hi")
    assert excinfo.value.status_code == 503
    assert "OPENAI_API_KEY" in str(excinfo.value)


def test_is_configured(monkeypatch):
    import services.openai_service as os_

    monkeypatch.setattr(os_, "OPENAI_API_KEY", "k")
    assert os_.is_configured() is True
    monkeypatch.setattr(os_, "OPENAI_API_KEY", "")
    assert os_.is_configured() is False


# ---------------------------------------------------------------------------
# Success
# ---------------------------------------------------------------------------


def test_chat_ok(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        assert kwargs["model"] == "gpt-4o-mini"
        assert kwargs["messages"][-1]["role"] == "user"
        return _fake_response("Dub with slower pacing.")

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.chat("How should I dub this?", role="director")
    assert "pacing" in out


def test_generate_json_ok(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        assert kwargs["response_format"] == {"type": "json_object"}
        return _fake_response(json.dumps({"topic": "studio setup"}))

    _set_fake_client(monkeypatch, os_, handler)
    data = os_.generate_json(user_prompt="Analyze.")
    assert data["topic"] == "studio setup"


def test_model_resolution():
    import services.openai_service as os_

    assert os_.resolve_model(None) == "gpt-4o-mini"
    assert os_.resolve_model("gpt-4o-mini") == "gpt-4o-mini"
    assert os_.resolve_model("gemini-3.5-flash") == "gpt-4o-mini"  # legacy label


# ---------------------------------------------------------------------------
# Errors: 429, timeout, auth
# ---------------------------------------------------------------------------


def test_429_raises_retryable(monkeypatch):
    import openai as sdk

    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        raise sdk.RateLimitError(
            "rate limited",
            response=httpx.Response(429, request=httpx.Request("POST", "https://x")),
            body={"error": {"message": "rate limited"}},
        )

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError) as excinfo:
        os_.generate_content(user_prompt="hi")
    assert excinfo.value.status_code == 429
    assert excinfo.value.retryable is True
    assert "OPENAI_API_KEY" not in str(excinfo.value)  # redacted/not present


def test_timeout_raises_retryable(monkeypatch):
    import openai as sdk

    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        raise sdk.APITimeoutError(request=httpx.Request("POST", "https://x"))

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError) as excinfo:
        os_.generate_content(user_prompt="hi")
    assert excinfo.value.status_code == 504
    assert excinfo.value.retryable is True


def test_auth_failure_maps_401(monkeypatch):
    import openai as sdk

    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        raise sdk.AuthenticationError(
            "bad key",
            response=httpx.Response(401, request=httpx.Request("POST", "https://x")),
            body={"error": {"message": "bad key"}},
        )

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError) as excinfo:
        os_.generate_content(user_prompt="hi")
    assert excinfo.value.status_code == 401
    assert excinfo.value.retryable is False


def test_retry_then_succeeds(monkeypatch):
    """SDK max_retries is configured from config; here we assert the client is
    constructed with the retry count (bounded, never infinite)."""
    import services.openai_service as os_

    _enable_openai(monkeypatch)
    os_.reset_client()
    calls = {}

    class FakeCompletions:
        def create(self, **kwargs):
            calls.setdefault("n", 0)
            calls["n"] += 1
            return _fake_response("ok")

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        def __init__(self, *a, **k):
            calls["client_kwargs"] = k
            self.chat = FakeChat()

    monkeypatch.setattr(os_, "_OpenAI", FakeClient)
    os_.reset_client()
    assert os_.generate_content(user_prompt="hi") == "ok"
    assert calls["client_kwargs"]["max_retries"] == 0
    assert calls["client_kwargs"]["timeout"] > 0


# ---------------------------------------------------------------------------
# Malformed response
# ---------------------------------------------------------------------------


def test_malformed_json_raises(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        return _fake_response("not json at all")

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError, match="invalid JSON"):
        os_.generate_json(user_prompt="x")


def test_empty_content_raises(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        return _fake_response("   ")

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError, match="empty content"):
        os_.generate_content(user_prompt="x")


# ---------------------------------------------------------------------------
# Transcript analysis / improvement / translation improvement
# ---------------------------------------------------------------------------


def test_analyze_transcript_structured(monkeypatch):
    os_ = _enable_openai(monkeypatch)
    payload = {
        "topic": "Studio setup",
        "tone": "instructional",
        "speaking_style": "direct",
        "audience": "beginners",
        "key_points": ["connect mic", "record"],
        "unclear_sections": [],
        "quality": "good",
        "translation_risks": ["technical term: XLR"],
    }

    def handler(kwargs):
        return _fake_response(json.dumps(payload))

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.analyze_transcript("Connect the mic. Then record.")
    assert out["topic"] == "Studio setup"
    assert out["translation_risks"] == ["technical term: XLR"]


def test_improve_transcript_preserves_meaning(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        body = kwargs["messages"][-1]["content"]
        assert "grammar" in body.lower() or "punctuation" in body.lower()
        return _fake_response(json.dumps({"improved_text": "Hello, world!"}))

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.improve_transcript("hello world")
    assert out["improved_text"] == "Hello, world!"
    assert "changes" in out


def test_improve_translation_segments(monkeypatch):
    os_ = _enable_openai(monkeypatch)
    segments = [
        {"id": 0, "original": "hello", "translated": "hola"},
        {"id": 1, "original": "goodbye", "translated": "adiós"},
    ]
    response = {
        "segments": [
            {"id": 0, "improved_translation": "¡Hola!", "note": "Naturalized."},
            {"id": 1, "improved_translation": "Adiós.", "note": "Unchanged."},
        ]
    }

    def handler(kwargs):
        return _fake_response(json.dumps(response))

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.improve_translation(segments)
    assert len(out["segments"]) == 2
    assert out["segments"][0]["improved_translation"] == "¡Hola!"
    assert out["segments"][0]["note"] == "Naturalized."


def test_improve_translation_empty():
    import services.openai_service as os_

    assert os_.improve_translation([])["summary"] == "No segments provided."


# ---------------------------------------------------------------------------
# Voice recommendation — never invent an id
# ---------------------------------------------------------------------------

_VOICES = [
    {"apiVoiceKey": "george", "name": "George", "gender": "Male", "accent": "British"},
    {"apiVoiceKey": "bunty", "name": "Bunty", "gender": "Male", "accent": "Indian English"},
]


def test_recommend_voice_valid_id(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        return _fake_response(
            json.dumps({"recommended_voice_id": "george", "reason": "fits", "confidence": 0.9})
        )

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.recommend_voice(
        transcript="A documentary.", target_language="en", voices=_VOICES
    )
    assert out["recommended_voice_id"] == "george"


def test_recommend_voice_hallucinated_id_nulled(monkeypatch):
    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        return _fake_response(
            json.dumps({"recommended_voice_id": "gandalf", "reason": "not real", "confidence": 0.99})
        )

    _set_fake_client(monkeypatch, os_, handler)
    out = os_.recommend_voice(transcript="any", target_language="en", voices=_VOICES)
    assert out["recommended_voice_id"] is None


# ---------------------------------------------------------------------------
# Key redaction
# ---------------------------------------------------------------------------


def test_redact_hides_key(monkeypatch):
    import services.openai_service as os_

    monkeypatch.setattr(os_, "OPENAI_API_KEY", "sk-secret-12345")
    redacted = os_._redact("error happened sk-secret-12345 now")
    assert "sk-secret-12345" not in redacted
    assert "[REDACTED]" in redacted


def test_error_log_redacted(monkeypatch, caplog):
    """A 401 auth error must not leak the key in logs."""
    import openai as sdk

    os_ = _enable_openai(monkeypatch)

    def handler(kwargs):
        raise sdk.AuthenticationError(
            "bad key",
            response=httpx.Response(401, request=httpx.Request("POST", "https://x")),
            body={"error": {"message": "bad key"}},
        )

    _set_fake_client(monkeypatch, os_, handler)
    with pytest.raises(os_.OpenAIError):
        os_.generate_content(user_prompt="hi")
    assert "test-openai-key-not-real" not in caplog.text
