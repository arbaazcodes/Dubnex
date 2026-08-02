import os

try:
    from elevenlabs.client import ElevenLabs
except ImportError:  # pragma: no cover - runtime fallback for missing dependency
    ElevenLabs = None

from config import (
    ELEVENLABS_API_KEY,
    ELEVENLABS_MODEL,
    OUTPUT_DIR,
    DEFAULT_VOICE_ID,
    VOICE_MAP,
)

client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ElevenLabs is not None else None

os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_all_voices():
    """
    Return all available voices from ElevenLabs.
    """

    if client is None:
        return []

    voices = client.voices.get_all()

    return [
        {
            "name": voice.name,
            "voice_id": voice.voice_id,
        }
        for voice in voices.voices
    ]


def generate_speech(
    text: str,
    filename: str = "speech.mp3",
    voice: str = "george",
):
    """
    Generate speech using ElevenLabs.

    voice:
        george
        bunty
        jessica
        ...
    """

    if client is None:
        raise RuntimeError("ElevenLabs client is unavailable. Install the elevenlabs package and configure ELEVENLABS_API_KEY.")

    filepath = os.path.join(OUTPUT_DIR, filename)

    voice_key = (voice or "george").strip().lower()
    voice_id = VOICE_MAP.get(voice_key)

    # Allow raw ElevenLabs voice IDs to pass through
    if not voice_id and len(voice_key) >= 20 and voice_key.replace("_", "").isalnum():
        voice_id = voice
    if not voice_id or voice_id.startswith("YOUR_"):
        voice_id = DEFAULT_VOICE_ID

    print(f"[ElevenLabs] Using voice key={voice_key!r} voice_id={voice_id!r}")

    audio = client.generate(
        text=text,
        voice=voice_id,
        model=ELEVENLABS_MODEL,
    )

    with open(filepath, "wb") as f:
        for chunk in audio:
            f.write(chunk)

    return filepath