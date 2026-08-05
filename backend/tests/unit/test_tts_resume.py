"""TTS segment checkpoint / resume / simulated 429 (Phase 1)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from services.elevenlabs_limiter import reset_limiter_for_tests
from services.elevenlabs_service import TtsErrorKind, TtsRequestError
import services.tts_service as tts


def _seg(i: int, text: str = "hello") -> dict:
    return {
        "id": i,
        "start": float(i),
        "end": float(i) + 1,
        "duration": 1.0,
        "translated": text,
    }


@pytest.fixture
def limiter_fast(monkeypatch):
    monkeypatch.setattr(tts, "TTS_429_MAX_RETRIES", 3)
    return reset_limiter_for_tests(
        max_concurrency=2,
        min_concurrency=1,
        adaptive=True,
        downgrade_threshold=2,
        recovery_streak=3,
    )


def test_manifest_resume_skips_completed(tmp_path, monkeypatch, limiter_fast):
    job_dir = tmp_path / "job1"
    job_dir.mkdir()
    done_path = job_dir / "segment_000.mp3"
    done_path.write_bytes(b"ID3done")
    manifest = {
        "version": 1,
        "job_id": "job1",
        "segments": {"0": {"status": "done", "path": str(done_path), "attempts": 1}},
    }
    (job_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    calls: list[int] = []

    def fake_synth(text, filepath, voice="george", timeout=None):
        sid = int(Path(filepath).stem.split("_")[1])
        calls.append(sid)
        Path(filepath).write_bytes(b"ID3new")
        return str(filepath)

    monkeypatch.setattr(tts, "synthesize_to_file", fake_synth)

    results = asyncio.run(
        tts.generate_segment_speech(
            [_seg(0, "a"), _seg(1, "b")],
            voice="george",
            work_dir=str(job_dir),
            job_id="job1",
        )
    )

    assert calls == [1]
    assert results[0]["audio"] == str(done_path)
    assert Path(results[1]["audio"]).is_file()
    saved = json.loads((job_dir / "manifest.json").read_text(encoding="utf-8"))
    assert saved["segments"]["0"]["status"] == "done"
    assert saved["segments"]["1"]["status"] == "done"


def test_simulated_429_then_success_resumes(tmp_path, monkeypatch, limiter_fast):
    job_dir = tmp_path / "job429"
    job_dir.mkdir()

    def flaky_synth(text, filepath, voice="george", timeout=None):
        sid = int(Path(filepath).stem.split("_")[1])
        if sid == 1:
            raise TtsRequestError(
                "too many requests",
                kind=TtsErrorKind.RATE_LIMIT,
                retry_after=0.01,
            )
        Path(filepath).write_bytes(b"ID3ok")
        return str(filepath)

    monkeypatch.setattr(tts, "synthesize_to_file", flaky_synth)
    monkeypatch.setattr(tts, "TTS_429_MAX_RETRIES", 1)
    monkeypatch.setattr(
        "services.tts_service.compute_backoff_seconds",
        lambda attempt, retry_after=None, **kwargs: 0.001,
    )

    with pytest.raises(RuntimeError, match="TTS failed"):
        asyncio.run(
            tts.generate_segment_speech(
                [_seg(0), _seg(1)],
                work_dir=str(job_dir),
                job_id="job429",
            )
        )

    assert (job_dir / "segment_000.mp3").is_file()
    saved = json.loads((job_dir / "manifest.json").read_text(encoding="utf-8"))
    assert saved["segments"]["0"]["status"] == "done"
    assert saved["segments"]["1"]["status"] == "failed"
    assert limiter_fast.sequential_mode is True or limiter_fast.current_concurrency == 1

    calls: list[int] = []

    def ok_synth(text, filepath, voice="george", timeout=None):
        sid = int(Path(filepath).stem.split("_")[1])
        calls.append(sid)
        Path(filepath).write_bytes(b"ID3ok2")
        return str(filepath)

    monkeypatch.setattr(tts, "synthesize_to_file", ok_synth)
    results = asyncio.run(
        tts.generate_segment_speech(
            [_seg(0), _seg(1)],
            work_dir=str(job_dir),
            job_id="job429",
        )
    )
    assert calls == [1]
    assert len(results) == 2
    assert all(Path(r["audio"]).is_file() for r in results)


def test_retry_after_used_on_rate_limit(tmp_path, monkeypatch, limiter_fast):
    job_dir = tmp_path / "jobra"
    job_dir.mkdir()
    sleeps: list[float] = []
    state = {"n": 0}

    def once_429(text, filepath, voice="george", timeout=None):
        state["n"] += 1
        if state["n"] == 1:
            raise TtsRequestError(
                "429",
                kind=TtsErrorKind.RATE_LIMIT,
                retry_after=0.05,
            )
        Path(filepath).write_bytes(b"ID3")
        return str(filepath)

    async def capture_sleep(delay):
        sleeps.append(delay)

    monkeypatch.setattr(tts, "synthesize_to_file", once_429)
    monkeypatch.setattr(asyncio, "sleep", capture_sleep)
    monkeypatch.setattr(
        "services.tts_service.compute_backoff_seconds",
        lambda attempt, retry_after=None, **kwargs: float(retry_after or 0.01),
    )

    results = asyncio.run(
        tts.generate_segment_speech(
            [_seg(0)],
            work_dir=str(job_dir),
            job_id="jobra",
        )
    )
    assert len(results) == 1
    assert sleeps and sleeps[0] == pytest.approx(0.05)
