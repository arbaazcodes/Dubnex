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


TRANSLATION_QA_SYSTEM = """You are a translation quality-control reviewer for audiovisual dubbing.
Compare each original segment with its translation and flag ONLY serious problems:
missing content, extra content, incorrect numbers, incorrect names, or major semantic changes.
Do NOT flag minor stylistic differences, word-order changes, or acceptable idiomatic rephrasing.
Be concise. If nothing serious is wrong, has_serious_issues must be false."""


def translation_qa_prompt(segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        original = seg.get("original") or ""
        translated = seg.get("translated") or ""
        lines.append(
            f"- id={seg.get('id')}: ORIGINAL: {original}\n    TRANSLATED: {translated}"
        )
    body = "\n".join(lines)
    return (
        "Review the translation quality of each segment pair below.\n"
        "Return ONLY valid JSON:\n"
        '{"has_serious_issues": true|false, '
        '"issues": [{"id": 0, "type": "missing_content|extra_content|wrong_number|wrong_name|semantic_change", '
        '"detail": "short explanation"}]}\n'
        "issues may be empty. has_serious_issues must be true if any serious problem exists.\n\n"
        f"SEGMENTS:\n{body}"
    )


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


VIDEO_ANALYSIS_SYSTEM = """You are Dubnex's video analyst for dubbing workflows.
Summarize what the video is about, note its structure and intended audience,
and answer the reviewer's question using only the provided transcript.
Never invent facts that are not in the transcript."""


def video_analysis_prompt(
    title: str, duration: str, transcript: str, query: str | None
) -> str:
    parts = [
        f"VIDEO TITLE: {title or 'Untitled'}",
        f"DURATION: {duration or 'unknown'}",
        "TRANSCRIPT:",
        transcript or "(no transcript available)",
    ]
    if query and query.strip():
        parts.append(f"\nANALYST QUESTION: {query.strip()}")
    parts.append(
        "\nReturn ONLY valid JSON:\n"
        '{"analysis": "markdown analysis answering the question (or overview if no question)", '
        '"summary": "2-3 sentence plain summary of the video content", '
        '"title": "improved short dubbing project title (no quotes, max 8 words)", '
        '"description": "one-paragraph description for the project"}\n'
        "Base everything strictly on the transcript."
    )
    return "\n".join(parts)


VOICE_RECOMMENDATION_SYSTEM = """You are Dubnex's voice selection specialist.
Based on the transcript tone, content, and target language, recommend the single
most suitable voice from the provided catalog. Match voice accent, category, and
supported languages to the content. Return a structured recommendation with reasons."""


def voice_recommendation_prompt(
    transcript: str, target_language: str | None, voices: list[dict]
) -> str:
    lines = []
    for v in voices:
        lines.append(
            f"- id={v.get('apiVoiceKey')}: {v.get('name')} "
            f"({v.get('gender')}, {v.get('accent')}, {v.get('category')}), "
            f"languages={','.join(v.get('supportedLanguages') or [])}"
        )
    body = "\n".join(lines)
    lang = (target_language or "").strip() or "the target language"
    return (
        f"Recommend ONE voice from the catalog below for dubbing this transcript into {lang}.\n"
        "Return ONLY valid JSON:\n"
        '{"recommended_voice_id": "exact id from the catalog", '
        '"reason": "1-2 sentence explanation", "confidence": 0.0-1.0}\n'
        "recommended_voice_id MUST be one of the catalog ids. Never invent an id.\n\n"
        f"TRANSCRIPT:\n{transcript}\n\n"
        f"CATALOG:\n{body}"
    )


TRANSCRIPT_ANALYSIS_SYSTEM = """You are Dubnex's transcript analyst for dubbing workflows.
Analyze the transcript and report ONLY what is present. Never invent facts,
speakers, topics, or numbers that do not appear in the text."""


def transcript_analysis_prompt(transcript: str) -> str:
    return (
        "Analyze the transcript below for a dubbing project.\n"
        "Return ONLY valid JSON with EXACTLY these keys:\n"
        '{"topic": "main topic", '
        '"tone": "overall tone", '
        '"speaking_style": "how the speaker talks", '
        '"audience": "intended audience", '
        '"key_points": ["point1", "point2", ...], '
        '"unclear_sections": ["quote or description of unclear part", ...], '
        '"quality": "brief assessment of transcript quality", '
        '"translation_risks": ["idiom, name, number, or technical term that may need care", ...]}\n'
        "Do NOT invent information that is not in the transcript.\n\n"
        f"TRANSCRIPT:\n{transcript}"
    )


TRANSCRIPT_IMPROVEMENT_SYSTEM = """You are Dubnex's transcript editor for dubbing.
Fix grammar, punctuation, and readability. Preserve meaning, speaker intent,
names, numbers, emojis, and technical terms exactly. Do NOT add information,
summarize, or rewrite content unnecessarily."""


def transcript_improvement_prompt(text: str) -> str:
    return (
        "Improve the grammar, punctuation, and readability of the transcript below.\n"
        "Preserve meaning, speaker intent, names, numbers, emojis, and technical terms.\n"
        "Do NOT add or remove information. Do NOT summarize.\n"
        "Return ONLY valid JSON:\n"
        '{"improved_text": "the improved transcript"}\n\n'
        f"TRANSCRIPT:\n{text}"
    )


TRANSLATION_IMPROVEMENT_SYSTEM = """You are Dubnex's translation improver for audiovisual dubbing.
For each original/translated segment pair, fix semantic errors, grammar, and
naturalness while preserving meaning, names, numbers, and technical terms.
Flag missing or extra content. Do NOT rewrite translations that are already correct."""


def translation_improvement_prompt(segments: list[dict]) -> str:
    lines = []
    for seg in segments:
        original = seg.get("original") or ""
        translated = seg.get("translated") or ""
        lines.append(
            f"- id={seg.get('id')}: ORIGINAL: {original}\n    TRANSLATED: {translated}"
        )
    body = "\n".join(lines)
    return (
        "Improve each translation below while preserving meaning, names, numbers, "
        "and technical terms. Fix grammar, semantic accuracy, and naturalness.\n"
        "Return ONLY valid JSON:\n"
        '{"segments": [{"id": 0, "improved_translation": "...", "note": "what changed or unchanged"}]}\n'
        "Keep the same id values. For segments that are already correct, return the same text "
        'with note "Unchanged."\n\n'
        f"SEGMENTS:\n{body}"
    )
