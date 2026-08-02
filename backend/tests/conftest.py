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
        "TRANSLATION_BATCH_SIZE": "4",
        "JOB_MAX_RETRIES": "2",
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
    el.get_all_voices = MagicMock(return_value=[])
    el.generate_speech = MagicMock(side_effect=lambda text, filename="x.mp3", voice="george": str(_OUT / filename))
    el.client = None
    sys.modules["services.elevenlabs_service"] = el


_install_ai_stubs()


@pytest.fixture
def auth_user():
    from services.firebase_auth import AuthenticatedUser

    return AuthenticatedUser(uid="user-test-1", email="t@example.com", name="Tester")


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
