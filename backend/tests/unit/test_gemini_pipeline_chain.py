"""
Mocked pipeline chain: Whisper → Gemini translate → ElevenLabs handoff.

Does not call live APIs. Validates wiring and timing preservation.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest


def test_whisper_gemini_elevenlabs_render_chain(monkeypatch, tmp_path):
    import services.gemini_service as gs
    import services.translator_service as ts
    import services.whisper_service as whisper
    import services.elevenlabs_service as el

    monkeypatch.setattr(ts, "TRANSLATION_PROVIDER", "gemini")
    monkeypatch.setattr(ts, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gs, "GEMINI_MAX_RETRIES", 0)
    monkeypatch.setattr(gs, "GEMINI_BACKOFF_JITTER_RATIO", 0.0)

    # 1) Whisper (stubbed in conftest)
    whisper_result = whisper.transcribe_audio(str(tmp_path / "audio.wav"))
    assert whisper_result["segments"]
    assert whisper_result["full_text"]

    # 2) Gemini translation
    def gemini_handler(request: httpx.Request) -> httpx.Response:
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
                                            "segments": [
                                                {"id": 0, "translated": "hola mundo"}
                                            ]
                                        }
                                    )
                                }
                            ]
                        }
                    }
                ]
            },
        )

    transport = httpx.MockTransport(gemini_handler)

    class Client(httpx.Client):
        def __init__(self, *a, **k):
            k["transport"] = transport
            super().__init__(*a, **k)

    monkeypatch.setattr(gs.httpx, "Client", Client)

    translated = ts.translate_segments(whisper_result["segments"], "en", "es")
    assert translated[0]["translated"] == "hola mundo"
    assert translated[0]["start"] == whisper_result["segments"][0]["start"]
    assert translated[0]["end"] == whisper_result["segments"][0]["end"]

    # 3) ElevenLabs TTS handoff (stubbed in conftest)
    out_path = tmp_path / "seg.mp3"
    el.synthesize_to_file(translated[0]["translated"], str(out_path), voice="george")
    el.synthesize_to_file.assert_called()
    call_args = el.synthesize_to_file.call_args
    assert call_args[0][0] == "hola mundo"

    # 4) Render artifact placeholder (final mux is FFmpeg; assert handoff data ready)
    render_ready = {
        "segments": translated,
        "tts_path": str(out_path),
        "source_language": whisper_result.get("language"),
    }
    assert render_ready["segments"][0]["translated"]
    assert Path(render_ready["tts_path"]).parent.exists()
