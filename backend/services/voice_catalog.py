"""
Dubnex voice catalog (backend mirror of the frontend library).

Only voices present in the local TTS provider can actually be used for TTS.
This catalog defines the available local voices for Coqui TTS XTTS v2.
"""

from __future__ import annotations

# Local TTS voice catalog - these are speaker references for XTTS v2 voice cloning
# When speaker_wav is provided, XTTS v2 clones that voice
# When no speaker_wav, XTTS v2 uses its built-in default speaker

# apiVoiceKey -> voice metadata (name, gender, accent, category, supportedLanguages)
# This mirrors frontend/src/constants/voices.ts for local TTS voices
_VOICE_META: dict[str, dict] = {
    "default": {
        "name": "Default (XTTS v2 Built-in)",
        "gender": "Neutral",
        "accent": "Multilingual",
        "category": "Default",
        "supportedLanguages": [
            "en", "es", "fr", "de", "it", "pt", "pl", "tr",
            "ru", "nl", "cs", "ar", "zh", "ja", "hu", "ko", "hi"
        ],
        "description": "XTTS v2 built-in multilingual speaker. No voice cloning.",
    },
    "cloned": {
        "name": "Custom Voice Clone",
        "gender": "Custom",
        "accent": "Custom",
        "category": "Voice Cloning",
        "supportedLanguages": [
            "en", "es", "fr", "de", "it", "pt", "pl", "tr",
            "ru", "nl", "cs", "ar", "zh", "ja", "hu", "ko", "hi"
        ],
        "description": "Upload a reference audio file (3-10 seconds) to clone any voice. Works across all supported languages.",
    },
}


def get_voice_catalog() -> list[dict]:
    """
    Return catalog entries for voices that are actually usable for local TTS.
    Each entry carries an apiVoiceKey.
    """
    catalog = []
    for key, meta in _VOICE_META.items():
        catalog.append(
            {
                "apiVoiceKey": key,
                "name": meta.get("name", key.title()),
                "gender": meta.get("gender", ""),
                "accent": meta.get("accent", ""),
                "category": meta.get("category", ""),
                "supportedLanguages": meta.get("supportedLanguages", []),
                "description": meta.get("description", ""),
            }
        )
    return catalog


def get_voice_meta(voice_key: str) -> dict | None:
    """Get metadata for a specific voice key."""
    return _VOICE_META.get(voice_key)


def is_valid_voice(voice_key: str) -> bool:
    """Check if a voice key is valid for local TTS."""
    return voice_key in _VOICE_META