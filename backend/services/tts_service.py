import asyncio
import os
import tempfile

from config import OUTPUT_DIR, TEMP_DIR, TTS_CONCURRENCY
from services.elevenlabs_service import generate_speech as eleven_generate_speech

os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)


async def generate_speech(
    text: str,
    language: str = "hindi",
    filename: str = "speech.mp3",
    voice: str = "george",
):
    """
    Generate a single MP3 using ElevenLabs.
    """
    return await asyncio.to_thread(
        eleven_generate_speech,
        text=text,
        filename=filename,
        voice=voice,
    )


async def generate_segment_speech(
    segments: list,
    language: str = "hindi",
    voice: str = "george",
    work_dir: str | None = None,
):
    """
    Generate one MP3 file for every translated segment.

    Controlled concurrency via TTS_CONCURRENCY (default 3).
    Segment files go under TEMP_DIR (or work_dir) to avoid OUTPUT_DIR clutter
    and enable cheap cleanup after merge.
    """
    if not segments:
        return []

    segment_dir = work_dir or tempfile.mkdtemp(prefix="tts_segments_", dir=TEMP_DIR)
    os.makedirs(segment_dir, exist_ok=True)
    sem = asyncio.Semaphore(TTS_CONCURRENCY)

    async def _one(segment: dict) -> dict:
        filename = f"segment_{segment['id']:03d}.mp3"
        # elevenlabs writes under OUTPUT_DIR by default — pass absolute path via chdir-safe name
        # Write into segment_dir by using a path relative trick: generate then move, OR
        # call with filename that includes only basename and move from OUTPUT_DIR.
        async with sem:
            filepath = await asyncio.to_thread(
                eleven_generate_speech,
                text=segment["translated"],
                filename=filename,
                voice=voice,
            )
        # Move into temp segment dir when ElevenLabs wrote to OUTPUT_DIR
        dest = os.path.join(segment_dir, filename)
        if os.path.abspath(filepath) != os.path.abspath(dest):
            try:
                os.replace(filepath, dest)
                filepath = dest
            except OSError:
                pass
        return {
            "id": segment["id"],
            "start": segment["start"],
            "end": segment["end"],
            "duration": segment["duration"],
            "text": segment["translated"],
            "audio": filepath,
        }

    # Preserve order: gather in input order
    results = await asyncio.gather(*[_one(seg) for seg in segments])
    return list(results)
