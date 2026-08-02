"""
Lightweight performance helpers: stage profiling, model warm-up, throughput notes.
Does not alter AI outputs — timing / warm-up only.
"""

from __future__ import annotations

import os
import tempfile
import time
import wave
from contextlib import contextmanager
from typing import Any, Iterator

from services.logging_service import get_logger

logger = get_logger("screen_ai.perf")


@contextmanager
def stage_timer(profile: dict[str, Any], name: str) -> Iterator[None]:
    started = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = round((time.perf_counter() - started) * 1000.0, 2)
        profile[name] = elapsed_ms
        logger.info(
            "stage profile",
            extra={
                "event": "stage_profile",
                "stage": name,
                "duration_ms": elapsed_ms,
            },
        )


def warm_whisper_model() -> dict[str, Any]:
    """
    Ensure Faster-Whisper is loaded and run a tiny decode to warm CUDA/CPU kernels.
    """
    started = time.perf_counter()
    from services import whisper_service

    model = getattr(whisper_service, "model", None)
    if model is None:
        return {"ok": False, "error": "whisper model missing", "duration_ms": 0}

    # 0.5s mono silence WAV
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        with wave.open(path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(b"\x00\x00" * 8000)
        # Use public API so warm-up matches production path
        whisper_service.transcribe_audio(path)
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        logger.info(
            "whisper warmed",
            extra={"event": "whisper_warmup", "duration_ms": duration_ms},
        )
        return {"ok": True, "duration_ms": duration_ms}
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        logger.warning(
            "whisper warm-up failed: %s",
            exc,
            extra={"event": "whisper_warmup_failed", "duration_ms": duration_ms},
        )
        return {"ok": False, "error": str(exc), "duration_ms": duration_ms}
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def warm_translation_model() -> dict[str, Any]:
    """Touch NLLB with a tiny string so first real job is not cold."""
    started = time.perf_counter()
    try:
        from services.translator_service import translate_text

        translate_text("Hello", "en", "hi")
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        logger.info(
            "translation warmed",
            extra={"event": "translation_warmup", "duration_ms": duration_ms},
        )
        return {"ok": True, "duration_ms": duration_ms}
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000.0, 2)
        return {"ok": False, "error": str(exc), "duration_ms": duration_ms}
