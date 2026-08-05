"""
Centralized Gemini prompt templates.

Keep prompts out of UI / route handlers. Never include secrets.
"""

from __future__ import annotations


TRANSLATION_SYSTEM = """You are a professional dubbing translator for audiovisual content.
Translate accurately while preserving speaker intent, punctuation, proper names,
emojis, numbers, and formatting. Do not add commentary. Do not invent content."""


def translation_text_prompt(
    text: str, source_language: str, target_language: str
) -> str:
    return (
        f"Translate the following text from {source_language} to {target_language}.\n"
        "Preserve punctuation, names, emojis, and formatting.\n"
        "Return ONLY valid JSON with this shape:\n"
        '{"translated_text": "<translation>"}\n\n'
        f"SOURCE:\n{text}"
    )


def translation_segments_prompt(
    segments: list[dict], source_language: str, target_language: str
) -> str:
    lines = []
    for seg in segments:
        sid = seg.get("id")
        text = seg.get("text") or seg.get("original") or ""
        lines.append(f"- id={sid}: {text}")
    body = "\n".join(lines)
    return (
        f"Translate each segment from {source_language} to {target_language}.\n"
        "Preserve punctuation, names, emojis, and formatting.\n"
        "Do NOT change id values. Do NOT merge or split segments.\n"
        "Return ONLY valid JSON:\n"
        '{"segments":[{"id":0,"translated":"..."},...]}\n\n'
        f"SEGMENTS:\n{body}"
    )


TRANSCRIPT_CLEANUP_SYSTEM = """You clean speech-to-text transcripts for dubbing.
Fix punctuation, grammar, and capitalization without changing meaning,
speaker intent, names, numbers, or emojis. Do not invent content."""


def transcript_cleanup_prompt(full_text: str, segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        lines.append(
            f"- id={seg.get('id')} start={seg.get('start')} end={seg.get('end')}: "
            f"{seg.get('text') or ''}"
        )
    body = "\n".join(lines)
    return (
        "Clean the Whisper transcript below.\n"
        "Return ONLY valid JSON:\n"
        '{"full_text":"...","segments":[{"id":0,"text":"..."},...]}\n'
        "Keep the same segment ids. Do not change timing fields.\n\n"
        f"FULL_TEXT:\n{full_text}\n\n"
        f"SEGMENTS:\n{body}"
    )


CHAT_SYSTEM_DEFAULT = (
    "You are Dubnex's supportive AI Dubbing Consultant. Help with production, "
    "script improvement, dubbing advice, and translation questions. Be concise "
    "and practical."
)

CHAT_SYSTEM_BY_ROLE = {
    "director": (
        "You are Dubnex's Executive Dubbing Director. Assist with speech pacing, "
        "cinematic voice selection, tone delivery, and theatrical translations."
    ),
    "language": (
        "You are Dubnex's Language Specialist. Help localise script segments, "
        "resolve idioms, match dialect timings, and translate naturally."
    ),
    "coach": (
        "You are Dubnex's Voice Coach. Advise on speed, pitch, emotion, and "
        "accent alignment for TTS / dubbing."
    ),
    "production": (
        "You are Dubnex's production assistant. Help plan dubbing workflows, "
        "QC checklists, and delivery notes."
    ),
}


def chat_system_for_role(role: str | None, override: str | None = None) -> str:
    if override and override.strip():
        return override.strip()
    key = (role or "").strip().lower()
    return CHAT_SYSTEM_BY_ROLE.get(key, CHAT_SYSTEM_DEFAULT)
