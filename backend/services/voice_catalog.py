"""
Dubnex voice catalog (backend mirror of the frontend library).

Only voices present in config.VOICE_MAP can actually be used for TTS, so this
catalog is the single source of truth for Gemini voice recommendations.
Never recommend an id that is not in VOICE_MAP.
"""

from __future__ import annotations

from config import VOICE_MAP

# apiVoiceKey -> voice metadata (name, gender, accent, category, supportedLanguages).
# This mirrors frontend/src/constants/voices.ts for the voices that are wired
# to ElevenLabs via VOICE_MAP.
_VOICE_META: dict[str, dict] = {
    "george": {
        "name": "George",
        "gender": "Male",
        "accent": "British",
        "category": "Narration",
        "supportedLanguages": ["en", "es", "fr", "de", "hi", "pt", "it", "ja"],
    },
    "jessica": {
        "name": "Jessica",
        "gender": "Female",
        "accent": "American",
        "category": "Corporate",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it", "nl"],
    },
    "bunty": {
        "name": "Bunty",
        "gender": "Male",
        "accent": "Indian English",
        "category": "Conversational",
        "supportedLanguages": ["en", "hi", "ur", "ta", "te", "gu", "pa"],
    },
    "bella": {
        "name": "Bella",
        "gender": "Female",
        "accent": "American",
        "category": "Conversational",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it"],
    },
    "adam": {
        "name": "Adam",
        "gender": "Male",
        "accent": "American",
        "category": "Broadcast",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it", "nl"],
    },
    "rachel": {
        "name": "Rachel",
        "gender": "Female",
        "accent": "American",
        "category": "Social",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it"],
    },
    "serena": {
        "name": "Serena",
        "gender": "Female",
        "accent": "British",
        "category": "Audiobook",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it"],
    },
    "marcus": {
        "name": "Marcus",
        "gender": "Male",
        "accent": "American",
        "category": "Cinematic",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it"],
    },
    "aria": {
        "name": "Aria",
        "gender": "Female",
        "accent": "American",
        "category": "Narration",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it"],
    },
    "daniel": {
        "name": "Daniel",
        "gender": "Male",
        "accent": "British",
        "category": "Broadcast",
        "supportedLanguages": ["en", "es", "fr", "de", "pt", "it", "nl"],
    },
}


def get_voice_catalog() -> list[dict]:
    """
    Return catalog entries for voices that are actually usable for TTS
    (present in VOICE_MAP). Each entry carries an apiVoiceKey.
    """
    catalog = []
    for key in VOICE_MAP:
        meta = _VOICE_META.get(key, {})
        catalog.append(
            {
                "apiVoiceKey": key,
                "name": meta.get("name", key.title()),
                "gender": meta.get("gender", ""),
                "accent": meta.get("accent", ""),
                "category": meta.get("category", ""),
                "supportedLanguages": meta.get("supportedLanguages", []),
            }
        )
    return catalog
