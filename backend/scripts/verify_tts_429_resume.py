"""
Phase-1 verification: simulated 429 + segment resume (no live ElevenLabs).

Run: backend/.venv/Scripts/python.exe backend/scripts/verify_tts_429_resume.py
"""

from __future__ import annotations

import asyncio
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from services.elevenlabs_limiter import reset_limiter_for_tests  # noqa: E402
from services.elevenlabs_service import TtsErrorKind, TtsRequestError  # noqa: E402
import services.tts_service as tts  # noqa: E402


def _seg(i: int) -> dict:
    return {
        "id": i,
        "start": float(i),
        "end": float(i) + 1.0,
        "duration": 1.0,
        "translated": f"text-{i}",
    }


async def main() -> int:
    reset_limiter_for_tests(
        max_concurrency=2,
        min_concurrency=1,
        adaptive=True,
        downgrade_threshold=2,
        recovery_streak=3,
    )
    tts.TTS_429_MAX_RETRIES = 1

    with tempfile.TemporaryDirectory(prefix="tts_verify_") as raw:
        job_dir = Path(raw)
        fail_counts = {"1": 0}

        def phase1(text, filepath, voice="george", timeout=None):
            sid = int(Path(filepath).stem.split("_")[1])
            if sid == 1:
                fail_counts["1"] += 1
                raise TtsRequestError(
                    "concurrent_limit_exceeded",
                    kind=TtsErrorKind.RATE_LIMIT,
                    retry_after=0.01,
                )
            Path(filepath).write_bytes(b"ID3-ok")
            return str(filepath)

        tts.synthesize_to_file = phase1  # type: ignore
        tts.compute_backoff_seconds = lambda *a, **k: 0.001  # type: ignore

        try:
            await tts.generate_segment_speech(
                [_seg(0), _seg(1), _seg(2)],
                work_dir=str(job_dir),
                job_id="verify-429",
            )
            print("FAIL: expected RuntimeError on first pass")
            return 1
        except RuntimeError as exc:
            print("PASS: first pass failed as expected:", exc)

        manifest = json.loads((job_dir / "manifest.json").read_text(encoding="utf-8"))
        assert manifest["segments"]["0"]["status"] == "done"
        assert manifest["segments"]["2"]["status"] == "done"
        assert manifest["segments"]["1"]["status"] == "failed"
        assert (job_dir / "segment_000.mp3").is_file()
        assert (job_dir / "segment_002.mp3").is_file()
        print("PASS: partial progress preserved for segments 0 and 2")

        calls: list[int] = []

        def phase2(text, filepath, voice="george", timeout=None):
            sid = int(Path(filepath).stem.split("_")[1])
            calls.append(sid)
            Path(filepath).write_bytes(b"ID3-resume")
            return str(filepath)

        tts.synthesize_to_file = phase2  # type: ignore
        results = await tts.generate_segment_speech(
            [_seg(0), _seg(1), _seg(2)],
            work_dir=str(job_dir),
            job_id="verify-429",
        )
        if calls != [1]:
            print("FAIL: expected only segment 1 to re-synthesize, got", calls)
            return 1
        if len(results) != 3:
            print("FAIL: expected 3 results")
            return 1
        print("PASS: resume synthesized only missing segment 1")
        print("PASS: simulated 429 resume verification OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
