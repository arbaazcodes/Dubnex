"""
Shared fixtures. Heavy AI modules are stubbed before app import so tests stay fast.
"""

from __future__ import annotations

import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# ---- Environment before any app/config import ----
_TEST_ROOT = Path(__file__).resolve().parent
_TMP = _TEST_ROOT / "_tmp"
_TMP.mkdir(exist_ok=True)
_OUT = _TMP / "outputs"
_TEMP = _TMP / "temp"
_DATA = _TMP / "data"
for p in (_OUT, _TEMP, _DATA):
    p.mkdir(exist_ok=True)

os.environ.update(
    {
        "DATABASE_PROVIDER": "sqlite",
        "DATABASE_URL": f"sqlite:///{(_DATA / 'test.db').as_posix()}",
        "QUEUE_BACKEND": "inline",
        "REDIS_URL": "",
        "FIREBASE_PROJECT_ID": "test-project",
        "STORAGE_PROVIDER": "local",
        "OUTPUT_DIR": str(_OUT),
        "TEMP_DIR": str(_TEMP),
        "DATA_DIR": str(_DATA),
        "PUBLIC_BASE_URL": "http://testserver",
        "CORS_ORIGINS": "http://testserver",
        "STRICT_STARTUP": "false",
        "WHISPER_WARMUP": "false",
        "PERF_PROFILE": "false",
        "TTS_CONCURRENCY": "2",
        "TTS_CONCURRENCY_MIN": "1",
        "TTS_REQUEST_TIMEOUT_SECONDS": "30",
        "TRANSLATION_BATCH_SIZE": "4",
        "JOB_MAX_RETRIES": "2",
        # Keep unit/integration tests on NLLB path by default; Gemini has dedicated tests.
        "TRANSLATION_PROVIDER": "nllb",
        "GEMINI_API_KEY": "",
        "GEMINI_CLEANUP_TRANSCRIPT": "false",
        "GEMINI_MAX_RETRIES": "2",
        "GEMINI_TIMEOUT_SECONDS": "5",
        "GEMINI_BACKOFF_BASE_SECONDS": "0.01",
        "GEMINI_BACKOFF_MAX_SECONDS": "0.05",
        "GEMINI_BACKOFF_JITTER_RATIO": "0",
        # OpenAI off by default in tests; dedicated OpenAI tests override this.
        "OPENAI_API_KEY": "",
        "OPENAI_MODEL": "gpt-4o-mini",
        "OPENAI_TIMEOUT_SECONDS": "5",
        "OPENAI_MAX_RETRIES": "0",
        "OPENAI_MAX_OUTPUT_TOKENS": "2048",
        "AI_PROVIDER": "auto",
        # Coqui TTS (XTTS v2) - Local/Free TTS
        "TTS_PROVIDER": "coqui",
        "TTS_MODEL": "tts_models/multilingual/multi-dataset/xtts_v2",
        "TTS_DEVICE": "cpu",
        "TTS_LANGUAGE": "en",
        "TTS_SPEAKER_WAV": "",
        "TTS_SPEED": "1.0",
    }
)


def _install_ai_stubs():
    """Replace whisper / translator / elevenlabs / pipeline-heavy imports."""
    whisper = types.ModuleType("services.whisper_service")
    whisper.model = MagicMock(name="WhisperModel")
    whisper.detect_language = MagicMock(
        return_value={"language": "en", "confidence": 0.99}
    )
    whisper.transcribe_audio = MagicMock(
        return_value={
            "language": "en",
            "confidence": 0.99,
            "full_text": "hello world",
            "segments": [
                {
                    "id": 0,
                    "start": 0.0,
                    "end": 1.0,
                    "duration": 1.0,
                    "text": "hello world",
                }
            ],
        }
    )
    sys.modules["services.whisper_service"] = whisper

    # Keep real translator for unit tests that import it; API tests may still load it.
    # Stub elevenlabs client usage - replace with Coqui TTS stub
    tts = types.ModuleType("services.tts_service")

    async def _fake_generate_speech(text, language="en", filename="speech.mp3", voice="default"):
        return str(_OUT / filename)

    async def _fake_generate_segment_speech(segments, language="en", voice="default", work_dir=None, job_id=None, on_progress=None):
        results = []
        for i, segment in enumerate(segments):
            sid = int(segment["id"])
            filepath = str(_OUT / f"segment_{sid:03d}.mp3")
            Path(filepath).write_bytes(b"ID3")
            results.append({
                "id": sid,
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["duration"],
                "text": segment["translated"],
                "audio": filepath,
            })
        return results

    def _fake_tts_job_dir(job_id):
        return str(_TEMP / "tts_jobs" / job_id)

    tts.generate_speech = _fake_generate_speech
    tts.generate_segment_speech = _fake_generate_segment_speech
    tts.tts_job_dir = _fake_tts_job_dir
    sys.modules["services.tts_service"] = tts


_install_ai_stubs()


@pytest.fixture
def auth_user():
    from services.firebase_auth import AuthenticatedUser

    return AuthenticatedUser(uid="user-test-1", email="t@example.com", name="Tester")


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """Rate-limit counters are process-global; give every test a clean budget."""
    from services.rate_limit import reset_rate_limiter

    reset_rate_limiter()
    yield
    reset_rate_limiter()


@pytest.fixture
def authed_client(auth_user, monkeypatch):
    """FastAPI TestClient with Firebase auth bypassed."""
    from fastapi.testclient import TestClient
    import app as app_module

    def _fake_require(request):
        return auth_user

    monkeypatch.setattr(app_module, "require_authenticated_user", _fake_require)
    monkeypatch.setattr(
        "services.secure_media_service.require_authenticated_user", _fake_require
    )
    monkeypatch.setattr(
        app_module,
        "run_startup_checks",
        lambda: {"ok": True, "strict": False, "checks": {}, "required": []},
    )
    with TestClient(app_module.app) as client:
        yield client


@pytest.fixture
def sample_mp4(tmp_path):
    path = tmp_path / "clip.mp4"
    # Minimal non-empty bytes (not a real MP4; upload validation only checks size/ext)
    path.write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 256)
    return path
