import os

from config import OUTPUT_DIR
from services.elevenlabs_service import generate_speech as eleven_generate_speech

os.makedirs(OUTPUT_DIR, exist_ok=True)


async def generate_speech(
    text: str,
    language: str = "hindi",
    filename: str = "speech.mp3",
    voice: str = "george",
):
    """
    Generate a single MP3 using ElevenLabs.
    """
    return eleven_generate_speech(
        text=text,
        filename=filename,
        voice=voice,
    )


async def generate_segment_speech(
    segments: list,
    language: str = "hindi",
    voice: str = "george",
):
    """
    Generate one MP3 file for every translated segment.
    """

    generated_files = []

    for segment in segments:

        filename = f"segment_{segment['id']:03d}.mp3"

        filepath = eleven_generate_speech(
            text=segment["translated"],
            filename=filename,
            voice=voice,
        )

        generated_files.append({
            "id": segment["id"],
            "start": segment["start"],
            "end": segment["end"],
            "duration": segment["duration"],
            "text": segment["translated"],
            "audio": filepath,
        })

    return generated_files