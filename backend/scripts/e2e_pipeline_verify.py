"""End-to-end dubbing pipeline verification (runs inside API/worker container)."""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import traceback

from services.elevenlabs_service import generate_speech
from services.pipeline_service import process_video


def main() -> int:
    os.makedirs("/app/temp", exist_ok=True)
    os.makedirs("/app/outputs", exist_ok=True)

    print("=== STAGE: seed speech for source video ===")
    speech = generate_speech(
        text="Hello everyone. Welcome to the dubbing pipeline verification test.",
        filename="e2e_seed_speech.mp3",
        voice="george",
    )
    print("seed_speech", speech, "size", os.path.getsize(speech))

    video_path = "/app/temp/e2e_source.mp4"
    cmd = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=640x360:d=4",
        "-i",
        speech,
        "-c:v",
        "libx264",
        "-tune",
        "stillimage",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-shortest",
        video_path,
    ]
    print("=== STAGE: Upload (create source MP4) ===")
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("upload_ok", video_path, os.path.getsize(video_path))

    stages: list[str] = []

    def on_progress(stage: str, message: str = "") -> None:
        print(f"[PROGRESS] {stage}: {message}")
        stages.append(stage)

    async def run() -> dict:
        print("=== STAGE: run process_video ===")
        return await process_video(
            video_path=video_path,
            target_language="es",
            voice="george",
            on_progress=on_progress,
        )

    try:
        result = asyncio.run(run())
        out = result.get("output_video")
        print("RESULT_KEYS", sorted(result.keys()))
        print("language", result.get("language"))
        print("original_text", (result.get("original_text") or "")[:200])
        print("translated_text", (result.get("translated_text") or "")[:200])
        print("segments", len(result.get("segments") or []))
        print("output_video", out)
        if out and os.path.isfile(out):
            print("FINAL_MP4_SIZE", os.path.getsize(out))
            probe = subprocess.check_output(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration:stream=codec_type,codec_name",
                    "-of",
                    "json",
                    out,
                ],
                text=True,
            )
            print("FFPROBE", probe[:800])
            data = json.loads(probe)
            codecs = [s.get("codec_name") for s in data.get("streams", [])]
            print("CODECS", codecs)
        print("STAGES_SEEN", stages)
        print("E2E_STATUS=SUCCESS")
        return 0
    except Exception:
        traceback.print_exc()
        print("STAGES_SEEN", stages)
        print("E2E_STATUS=FAILED")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
