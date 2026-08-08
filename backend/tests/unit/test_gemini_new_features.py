"""
Tests for the new Gemini-backed features:
  - translation quality check (+ pipeline retry-once wiring)
  - video/transcript analysis (summary + title + description)
  - voice recommendation (never invents a voice id)

All Gemini HTTP calls are mocked; no live API key required.
"""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest


# ---------------------------------------------------------------------------
# Helpers shared by the mocked-HTTP tests
# ---------------------------------------------------------------------------


def _mock_client(monkeypatch, module, handler):
    """Patch module.httpx.Client to use a MockTransport."""
    transport = httpx.MockTransport(handler)

    class Client(httpx.Client):
        def __init__(self, *a, **k):
            k["transport"] = transport
            super().__init__(*a, **k)

    monkeypatch.setattr(module.httpx, "Client", Client)


def _ok_json(text: str) -> httpx.Response:
    return httpx.Response(
        200,
        json={"candidates": [{"content": {"parts": [{"text": text}]}}]},
    )


def _enable_gemini(monkeypatch):
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 0)
    return gs


# ---------------------------------------------------------------------------
# Translation QA service
# ---------------------------------------------------------------------------


def test_quality_check_translation_empty():
    import services.gemini_service as gs

    assert gs.quality_check_translation([]) == {
        "has_serious_issues": False,
        "issues": [],
    }


def test_quality_check_translation_ok(monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        assert "Review the translation quality" in request.content.decode()
        return _ok_json(json.dumps({"has_serious_issues": False, "issues": []}))

    _mock_client(monkeypatch, gs, handler)
    segments = [
        {"id": 0, "original": "hello", "translated": "hola"},
        {"id": 1, "original": "goodbye", "translated": "adiós"},
    ]
    out = gs.quality_check_translation(segments)
    assert out["has_serious_issues"] is False
    assert out["issues"] == []


def test_quality_check_translation_flags_issues(monkeypatch):
    gs = _enable_gemini(monkeypatch)
    issues = [
        {"id": 3, "type": "wrong_number", "detail": "price 100 vs 1000"},
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(json.dumps({"has_serious_issues": True, "issues": issues}))

    _mock_client(monkeypatch, gs, handler)
    out = gs.quality_check_translation([{"id": 3, "original": "100", "translated": "1000"}])
    assert out["has_serious_issues"] is True
    assert out["issues"][0]["type"] == "wrong_number"


def test_quality_check_translation_malformed_json(monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json("not json at all")

    _mock_client(monkeypatch, gs, handler)
    with pytest.raises(gs.GeminiError, match="invalid JSON"):
        gs.quality_check_translation([{"id": 0, "original": "x", "translated": "y"}])


# ---------------------------------------------------------------------------
# Video analysis service
# ---------------------------------------------------------------------------


def test_analyze_video_returns_structured(monkeypatch):
    gs = _enable_gemini(monkeypatch)
    response = {
        "analysis": "### Overview\nThe video explains the setup.",
        "summary": "A tutorial about setting up a studio.",
        "title": "Studio Setup Guide",
        "description": "A practical guide to studio configuration.",
    }

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        assert "ANALYST QUESTION" in body
        return _ok_json(json.dumps(response))

    _mock_client(monkeypatch, gs, handler)
    out = gs.analyze_video(
        title="Clip", duration="00:30", transcript="speech text", query="summarize"
    )
    assert out["analysis"].startswith("### Overview")
    assert out["summary"]
    assert out["title"] == "Studio Setup Guide"
    assert out["description"]


# ---------------------------------------------------------------------------
# Voice recommendation service — the id is validated against the real catalog
# ---------------------------------------------------------------------------

_VOICES = [
    {
        "apiVoiceKey": "george",
        "name": "George",
        "gender": "Male",
        "accent": "British",
        "category": "Narration",
        "supportedLanguages": ["en", "es", "fr", "de", "hi"],
    },
    {
        "apiVoiceKey": "bunty",
        "name": "Bunty",
        "gender": "Male",
        "accent": "Indian English",
        "category": "Conversational",
        "supportedLanguages": ["en", "hi", "ur", "ta", "te"],
    },
]


def test_recommend_voice_returns_catalog_id(monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        assert "george" in body and "bunty" in body
        return _ok_json(
            json.dumps(
                {
                    "recommended_voice_id": "george",
                    "reason": "Documentary narration fits George.",
                    "confidence": 0.9,
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    out = gs.recommend_voice(
        transcript="A documentary about space.", target_language="en", voices=_VOICES
    )
    assert out["recommended_voice_id"] == "george"
    assert out["reason"]
    assert out["confidence"] == 0.9


def test_recommend_voice_never_invents_id(monkeypatch):
    """Gemini hallucinating a non-catalog id must not be trusted."""
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(
            json.dumps(
                {
                    "recommended_voice_id": "gandalf-the-grey",
                    "reason": "not real",
                    "confidence": 0.99,
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    out = gs.recommend_voice(
        transcript="any", target_language="en", voices=_VOICES
    )
    assert out["recommended_voice_id"] is None


# ---------------------------------------------------------------------------
# API: /api/analyze-video
# ---------------------------------------------------------------------------


def test_analyze_video_missing_key(authed_client):
    res = authed_client.post(
        "/api/analyze-video",
        json={"title": "Clip", "transcript": "hello"},
    )
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["error"]


def test_analyze_video_ok(authed_client, monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(
            json.dumps(
                {
                    "analysis": "### Analysis\nA product walkthrough.",
                    "summary": "Product walkthrough.",
                    "title": "Product Tour",
                    "description": "Guided tour.",
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    res = authed_client.post(
        "/api/analyze-video",
        json={"title": "Clip", "duration": "00:30", "transcript": "hello there"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["analysis"].startswith("### Analysis")
    assert body["title"] == "Product Tour"
    assert body["description"]


def test_analyze_video_accepts_segment_array(authed_client, monkeypatch):
    """Frontend sends TranscriptSegment[]; endpoint joins .text into the prompt."""
    gs = _enable_gemini(monkeypatch)
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = request.content.decode()
        return _ok_json(
            json.dumps(
                {
                    "analysis": "### Analysis\nJoined segments.",
                    "summary": "s",
                    "title": "t",
                    "description": "d",
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    res = authed_client.post(
        "/api/analyze-video",
        json={
            "title": "Clip",
            "transcript": [
                {"id": "0", "text": "hello there"},
                {"id": "1", "text": "world"},
            ],
        },
    )
    assert res.status_code == 200
    assert "hello there" in seen["body"]
    assert "world" in seen["body"]


def test_analyze_video_empty_analysis_502(authed_client, monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(
            json.dumps(
                {
                    "analysis": "   ",
                    "summary": "",
                    "title": "",
                    "description": "",
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    res = authed_client.post(
        "/api/analyze-video",
        json={"title": "Clip", "transcript": "hello"},
    )
    assert res.status_code == 502


# ---------------------------------------------------------------------------
# API: /api/recommend-voice
# ---------------------------------------------------------------------------


def test_recommend_voice_requires_transcript(authed_client):
    res = authed_client.post("/api/recommend-voice", json={})
    assert res.status_code == 400


def test_recommend_voice_missing_key(authed_client):
    res = authed_client.post(
        "/api/recommend-voice", json={"transcript": "hello"}
    )
    assert res.status_code == 503
    assert "GEMINI_API_KEY" in res.json()["error"]


def test_recommend_voice_ok(authed_client, monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(
            json.dumps(
                {
                    "recommended_voice_id": "bunty",
                    "reason": "Conversational South Asian fit.",
                    "confidence": 0.85,
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    res = authed_client.post(
        "/api/recommend-voice",
        json={"transcript": "A friendly chat.", "target_language": "hi"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["recommended_voice_id"] == "bunty"
    assert "bunty" in body["available_voice_ids"]


def test_recommend_voice_hallucinated_id_nulled(authed_client, monkeypatch):
    gs = _enable_gemini(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_json(
            json.dumps(
                {
                    "recommended_voice_id": "no-such-voice",
                    "reason": "hallucination",
                    "confidence": 0.9,
                }
            )
        )

    _mock_client(monkeypatch, gs, handler)
    res = authed_client.post(
        "/api/recommend-voice",
        json={"transcript": "hello", "target_language": "en"},
    )
    assert res.status_code == 200
    assert res.json()["recommended_voice_id"] is None


# ---------------------------------------------------------------------------
# Pipeline wiring: translation QA retries once on serious issues
# ---------------------------------------------------------------------------


def _run_pipeline(monkeypatch, qa_result_sequence, gs_quality_check=None):
    """Drive process_video with heavy steps mocked; return (payload, call_log)."""
    import services.pipeline_service as ps
    import services.gemini_service as gs

    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(ps, "GEMINI_TRANSLATION_QA", True)

    call_log = {"translate_text": 0, "translate_segments": 0, "qa": 0}

    def fake_translate_text(text, source, target):
        call_log["translate_text"] += 1
        return "translated full text"

    def fake_translate_segments(segments, source, target):
        call_log["translate_segments"] += 1
        return [
            {
                "id": s["id"],
                "start": s["start"],
                "end": s["end"],
                "duration": s["duration"],
                "original": s["text"],
                "translated": f"translated-{s['id']}",
            }
            for s in segments
        ]

    def fake_quality_check(segments):
        call_log["qa"] += 1
        result = qa_result_sequence[min(call_log["qa"] - 1, len(qa_result_sequence) - 1)]
        return dict(result)

    monkeypatch.setattr(ps, "translate_text", fake_translate_text)
    monkeypatch.setattr(ps, "translate_segments", fake_translate_segments)
    monkeypatch.setattr(gs, "quality_check_translation", fake_quality_check)
    monkeypatch.setattr(ps, "extract_audio", lambda path: str(path) + ".wav")
    monkeypatch.setattr(ps, "generate_segment_speech", _async_fake_tts)
    monkeypatch.setattr(ps, "merge_audio_segments", lambda audio: "merged.mp3")
    monkeypatch.setattr(ps, "replace_audio", lambda video, audio: "final.mp4")

    async def run():
        return await ps.process_video(
            "video.mp4", target_language="es", voice="george", job_id=None
        )

    payload = asyncio.run(run())
    return payload, call_log


async def _async_fake_tts(segments, **kwargs):
    return [{"path": f"seg-{s['id']}.mp3"} for s in segments]


def test_pipeline_qa_passes_without_retry(monkeypatch):
    payload, log = _run_pipeline(
        monkeypatch,
        qa_result_sequence=[{"has_serious_issues": False, "issues": []}],
    )
    assert log["qa"] == 1
    assert log["translate_segments"] == 1
    assert log["translate_text"] == 1
    assert payload["segments"][0]["translated"] == "translated-0"


def test_pipeline_qa_retries_once(monkeypatch):
    """Serious issues -> one retranslation (bounded, no infinite loop)."""
    payload, log = _run_pipeline(
        monkeypatch,
        qa_result_sequence=[
            {"has_serious_issues": True, "issues": [{"id": 0, "type": "wrong_number"}]},
        ],
    )
    # QA runs once; on serious issues the segment+full-text translation runs again.
    assert log["qa"] == 1
    assert log["translate_segments"] == 2
    assert log["translate_text"] == 2
    assert payload["success"] is True


def test_pipeline_qa_disabled(monkeypatch):
    import services.pipeline_service as ps
    import services.gemini_service as gs

    monkeypatch.setattr(ps, "GEMINI_TRANSLATION_QA", False)
    qa_called = {"n": 0}

    def fake_quality_check(segments):
        qa_called["n"] += 1
        return {"has_serious_issues": False, "issues": []}

    def fake_translate_segments(segments, source, target):
        return [
            {
                "id": s["id"],
                "start": s["start"],
                "end": s["end"],
                "duration": s["duration"],
                "original": s["text"],
                "translated": "x",
            }
            for s in segments
        ]

    monkeypatch.setattr(gs, "quality_check_translation", fake_quality_check)
    monkeypatch.setattr(ps, "translate_segments", fake_translate_segments)
    monkeypatch.setattr(ps, "translate_text", lambda *a, **k: "x")
    monkeypatch.setattr(ps, "extract_audio", lambda path: str(path) + ".wav")
    monkeypatch.setattr(ps, "generate_segment_speech", _async_fake_tts)
    monkeypatch.setattr(ps, "merge_audio_segments", lambda audio: "merged.mp3")
    monkeypatch.setattr(ps, "replace_audio", lambda video, audio: "final.mp4")

    async def run():
        return await ps.process_video("v.mp4", "es", voice="george", job_id=None)

    payload = asyncio.run(run())
    assert qa_called["n"] == 0
    assert payload["success"] is True
