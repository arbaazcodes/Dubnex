"""
Phase-1 verification: simulated TTS error + segment resume (local Coqui TTS).

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

import services.tts_service as tts  # noqa: E402
from services.tts_provider import TTSError, TTSErrorKind  # noqa: E402


def _seg(i: int) -> dict:
    return {
        "id": i,
        "start": float(i),
        "end": float(i) + 1.0,
        "duration": 1.0,
        "translated": f"text-{i}",
    }


async def main() -> int:
    # Override TTS config for fast testing
    tts.TTS_CONCURRENCY = 2
    tts.TTS_CONCURRENCY_MIN = 1
    # Reset global provider so it picks up new config
    import services.tts_service as tts_module
    tts_module._provider = None

    with tempfile.TemporaryDirectory(prefix="tts_verify_") as raw:
        job_dir = Path(raw)
        fail_counts = {"1": 0}

        original_synthesize = tts_module._get_provider().synthesize

        def phase1_synthesize(text, output_path, language=None, speaker_wav=None, speed=None):
            sid = int(Path(output_path).stem.split("_")[1])
            if sid == 1:
                fail_counts["1"] += 1
                raise TTSError(
                    "Simulated GPU OOM error",
                    kind=TTSErrorKind.RETRYABLE,
                )
            # Write a dummy MP3 file
            Path(output_path).write_bytes(b"ID3-ok")
            return str(output_path)

        # Replace the provider's synthesize method
        provider = tts_module._get_provider()
        provider.synthesize = phase1_synthesize  # type: ignore

        try:
            await tts.generate_segment_speech(
                [_seg(0), _seg(1), _seg(2)],
                work_dir=str(job_dir),
                job_id="verify-retry",
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

        def phase2_synthesize(text, output_path, language=None, speaker_wav=None, speed=None):
            sid = int(Path(output_path).stem.split("_")[1])
            calls.append(sid)
            Path(output_path).write_bytes(b"ID3-resume")
            return str(output_path)

        provider.synthesize = phase2_synthesize  # type: ignore
        results = await tts.generate_segment_speech(
            [_seg(0), _seg(1), _seg(2)],
            work_dir=str(job_dir),
            job_id="verify-retry",
        )
        if calls != [1]:
            print("FAIL: expected only segment 1 to re-synthesize, got", calls)
            return 1
        if len(results) != 3:
            print("FAIL: expected 3 results")
            return 1
        print("PASS: resume synthesized only missing segment 1")
        print("PASS: simulated retry resume verification OK")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))