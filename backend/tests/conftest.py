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
        "TTS_429_MAX_RETRIES": "5",
        "TTS_BACKOFF_BASE_SECONDS": "0.01",
        "TTS_BACKOFF_MAX_SECONDS": "0.05",
        "TTS_BACKOFF_JITTER_RATIO": "0",
        "TTS_REQUEST_TIMEOUT_SECONDS": "30",
        "TTS_ADAPTIVE_ENABLED": "true",
        "TTS_DOWNGRADE_THRESHOLD": "2",
        "TTS_RECOVERY_SUCCESS_STREAK": "5",
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
    # Stub elevenlabs client usage
    el = types.ModuleType("services.elevenlabs_service")

    class _Kind(str):
        pass

    class _TtsErrorKind:
        RATE_LIMIT = _Kind("rate_limit")
        RETRYABLE = _Kind("retryable")
        FATAL = _Kind("fatal")

    class _TtsRequestError(Exception):
        def __init__(self, message, *, kind, retry_after=None, cause=None):
            super().__init__(message)
            self.kind = kind
            self.retry_after = retry_after

    el.get_all_voices = MagicMock(return_value=[])
    el.generate_speech = MagicMock(side_effect=lambda text, filename="x.mp3", voice="george": str(_OUT / filename))
    el.synthesize_to_file = MagicMock(
        side_effect=lambda text, filepath, voice="george", timeout=None: (
            Path(filepath).write_bytes(b"ID3"),
            str(filepath),
        )[1]
    )
    el.client = None
    el.TtsErrorKind = _TtsErrorKind
    el.TtsRequestError = _TtsRequestError
    el.classify_tts_error = MagicMock(return_value=_TtsErrorKind.FATAL)
    sys.modules["services.elevenlabs_service"] = el


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
