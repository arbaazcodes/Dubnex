"""
Google Gemini API client (backend-only).

Reads GEMINI_API_KEY from environment via config. Never logs the key.
Uses the Generative Language REST API over httpx with retries / timeouts.
"""

from __future__ import annotations

import json
import random
import re
import time
from typing import Any

import httpx

from config import (
    GEMINI_API_KEY,
    GEMINI_BACKOFF_BASE_SECONDS,
    GEMINI_BACKOFF_JITTER_RATIO,
    GEMINI_BACKOFF_MAX_SECONDS,
    GEMINI_MAX_RETRIES,
    GEMINI_MODEL,
    GEMINI_TIMEOUT_SECONDS,
)
from services.logging_service import get_logger
from services import prompt_templates as prompts

logger = get_logger("screen_ai.gemini")

_API_ROOT = "https://generativelanguage.googleapis.com/v1beta"

# Map frontend / legacy model labels to current Gemini model ids.
_MODEL_ALIASES = {
    "gemini-3.5-flash": "gemini-2.0-flash",
    "gemini-3.1-pro-preview": "gemini-2.5-pro",
    "gemini-3.1-flash-lite": "gemini-2.0-flash-lite",
    "gemini-2.0-flash": "gemini-2.0-flash",
    "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
    "gemini-2.5-flash": "gemini-2.5-flash",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini-1.5-flash": "gemini-1.5-flash",
    "gemini-1.5-pro": "gemini-1.5-pro",
}


class GeminiError(Exception):
    """Friendly Gemini failure for API / pipeline callers."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        retryable: bool = False,
        retry_after: float | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable
        self.retry_after = retry_after


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def resolve_model(model_name: str | None = None) -> str:
    raw = (model_name or GEMINI_MODEL or "gemini-2.0-flash").strip()
    return _MODEL_ALIASES.get(raw, raw)


def _redact(text: str) -> str:
    if not GEMINI_API_KEY:
        return text
    return text.replace(GEMINI_API_KEY, "[REDACTED]")


def _map_http_error(status: int, body: str) -> GeminiError:
    blob = (body or "").lower()
    if status in (401, 403) or "api key not valid" in blob or "permission" in blob:
        return GeminiError(
            "Gemini authentication failed. Check GEMINI_API_KEY.",
            status_code=status,
            retryable=False,
        )
    if status == 429 or "quota" in blob or "rate" in blob:
        return GeminiError(
            "Gemini rate limit or quota exceeded. Please retry shortly.",
            status_code=status,
            retryable=True,
        )
    if status >= 500:
        return GeminiError(
            "Gemini service is temporarily unavailable.",
            status_code=status,
            retryable=True,
        )
    return GeminiError(
        f"Gemini request failed (HTTP {status}).",
        status_code=status,
        retryable=False,
    )


def _parse_retry_after(headers: httpx.Headers) -> float | None:
    raw = headers.get("Retry-After") or headers.get("retry-after")
    if not raw:
        return None
    try:
        return max(0.0, float(str(raw).strip()))
    except ValueError:
        return None


def _backoff_seconds(attempt: int, retry_after: float | None = None) -> float:
    exp = min(
        GEMINI_BACKOFF_MAX_SECONDS,
        GEMINI_BACKOFF_BASE_SECONDS * (2 ** max(0, attempt)),
    )
    delay = max(exp, float(retry_after or 0.0))
    delay = min(GEMINI_BACKOFF_MAX_SECONDS, delay)
    if GEMINI_BACKOFF_JITTER_RATIO <= 0:
        return delay
    low = max(0.0, 1.0 - GEMINI_BACKOFF_JITTER_RATIO)
    high = 1.0 + GEMINI_BACKOFF_JITTER_RATIO
    return min(GEMINI_BACKOFF_MAX_SECONDS, delay * random.uniform(low, high))


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        raise GeminiError("Gemini returned no candidates.", retryable=True)
    parts = (
        ((candidates[0] or {}).get("content") or {}).get("parts") or []
    )
    chunks: list[str] = []
    for part in parts:
        text = part.get("text")
        if text:
            chunks.append(str(text))
    text = "\n".join(chunks).strip()
    if not text:
        raise GeminiError("Gemini returned empty content.", retryable=True)
    return text


_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def _parse_json_content(text: str) -> dict[str, Any]:
    raw = text.strip()
    fence = _JSON_FENCE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    # Best-effort: find first {...} block
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        try:
            data = json.loads(raw[start : end + 1])
            if isinstance(data, dict):
                return data
        except json.JSONDecodeError:
            pass
    raise GeminiError("Gemini returned invalid JSON.", retryable=True)


def generate_content(
    *,
    user_prompt: str,
    system_instruction: str | None = None,
    model_name: str | None = None,
    temperature: float = 0.2,
    response_json: bool = False,
) -> str:
    """
    Execute a Gemini generateContent call with retries.
    Raises GeminiError on terminal failure.
    """
    if not is_configured():
        raise GeminiError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend environment.",
            status_code=503,
            retryable=False,
        )

    model = resolve_model(model_name)
    url = f"{_API_ROOT}/models/{model}:generateContent"
    contents = [{"role": "user", "parts": [{"text": user_prompt}]}]
    body: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
        },
    }
    if system_instruction:
        body["systemInstruction"] = {
            "parts": [{"text": system_instruction}],
        }
    if response_json:
        body["generationConfig"]["responseMimeType"] = "application/json"

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
    }

    last_error: GeminiError | None = None
    for attempt in range(0, GEMINI_MAX_RETRIES + 1):
        try:
            with httpx.Client(timeout=GEMINI_TIMEOUT_SECONDS) as client:
                resp = client.post(url, headers=headers, json=body)
            if resp.status_code == 200:
                payload = resp.json()
                return _extract_text(payload)

            err = _map_http_error(resp.status_code, resp.text)
            err.retry_after = _parse_retry_after(resp.headers)
            last_error = err
            if not err.retryable or attempt >= GEMINI_MAX_RETRIES:
                logger.error(
                    "Gemini request failed",
                    extra={
                        "event": "gemini_error",
                        "status_code": resp.status_code,
                        "attempt": attempt + 1,
                        "model": model,
                        "error": _redact(str(err)),
                    },
                )
                raise err
            wait = _backoff_seconds(attempt, err.retry_after)
            logger.warning(
                "Gemini retryable error; backing off",
                extra={
                    "event": "gemini_retry",
                    "status_code": resp.status_code,
                    "attempt": attempt + 1,
                    "wait_time_seconds": wait,
                    "model": model,
                },
            )
            time.sleep(wait)
        except GeminiError:
            raise
        except httpx.TimeoutException as exc:
            last_error = GeminiError(
                "Gemini request timed out.",
                status_code=504,
                retryable=True,
            )
            if attempt >= GEMINI_MAX_RETRIES:
                logger.error(
                    "Gemini timeout exhausted",
                    extra={"event": "gemini_timeout", "attempt": attempt + 1},
                )
                raise last_error from exc
            wait = _backoff_seconds(attempt)
            logger.warning(
                "Gemini timeout; retrying",
                extra={
                    "event": "gemini_retry",
                    "attempt": attempt + 1,
                    "wait_time_seconds": wait,
                },
            )
            time.sleep(wait)
        except httpx.HTTPError as exc:
            last_error = GeminiError(
                "Gemini network error.",
                status_code=502,
                retryable=True,
            )
            if attempt >= GEMINI_MAX_RETRIES:
                raise last_error from exc
            time.sleep(_backoff_seconds(attempt))

    assert last_error is not None
    raise last_error


def generate_json(
    *,
    user_prompt: str,
    system_instruction: str | None = None,
    model_name: str | None = None,
    temperature: float = 0.1,
) -> dict[str, Any]:
    text = generate_content(
        user_prompt=user_prompt,
        system_instruction=system_instruction,
        model_name=model_name,
        temperature=temperature,
        response_json=True,
    )
    return _parse_json_content(text)


def translate_text(text: str, source_language: str, target_language: str) -> str:
    if not (text or "").strip():
        return ""
    data = generate_json(
        user_prompt=prompts.translation_text_prompt(
            text, source_language, target_language
        ),
        system_instruction=prompts.TRANSLATION_SYSTEM,
        temperature=0.1,
    )
    translated = data.get("translated_text")
    if translated is None:
        raise GeminiError("Gemini translation JSON missing translated_text.")
    return str(translated)


def translate_segments(
    segments: list[dict],
    source_language: str,
    target_language: str,
) -> list[dict]:
    """
    Translate Whisper-style segments; preserve id/start/end/duration/original.
    """
    if not segments:
        return []

    # Only send non-empty text segments to the model; empty stay empty.
    payload_segs = [
        {"id": seg["id"], "text": seg.get("text") or ""}
        for seg in segments
    ]
    data = generate_json(
        user_prompt=prompts.translation_segments_prompt(
            payload_segs, source_language, target_language
        ),
        system_instruction=prompts.TRANSLATION_SYSTEM,
        temperature=0.1,
    )
    items = data.get("segments") or []
    by_id: dict[Any, str] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        by_id[item.get("id")] = str(item.get("translated") or "")

    out: list[dict] = []
    for segment in segments:
        sid = segment["id"]
        original = segment.get("text") or ""
        translated = by_id.get(sid)
        if translated is None:
            # Fallback: translate single segment if batch missed an id
            translated = (
                translate_text(original, source_language, target_language)
                if original.strip()
                else ""
            )
        out.append(
            {
                "id": sid,
                "start": segment["start"],
                "end": segment["end"],
                "duration": segment["duration"],
                "original": original,
                "translated": translated,
            }
        )
    return out


def cleanup_transcript(result: dict[str, Any]) -> dict[str, Any]:
    """
    Optional Whisper cleanup. Preserves timing; updates text fields only.
    """
    full_text = result.get("full_text") or ""
    segments = list(result.get("segments") or [])
    if not full_text and not segments:
        return result

    data = generate_json(
        user_prompt=prompts.transcript_cleanup_prompt(full_text, segments),
        system_instruction=prompts.TRANSCRIPT_CLEANUP_SYSTEM,
        temperature=0.0,
    )
    cleaned_full = data.get("full_text")
    cleaned_segs = data.get("segments") or []
    by_id = {
        item.get("id"): str(item.get("text") or "")
        for item in cleaned_segs
        if isinstance(item, dict)
    }

    new_segments = []
    for seg in segments:
        sid = seg.get("id")
        new_seg = dict(seg)
        if sid in by_id and by_id[sid]:
            new_seg["text"] = by_id[sid]
        new_segments.append(new_seg)

    updated = dict(result)
    if cleaned_full:
        updated["full_text"] = str(cleaned_full)
    updated["segments"] = new_segments
    return updated


def chat(
    message: str,
    *,
    history: list[dict] | None = None,
    system_instruction: str | None = None,
    role: str | None = None,
    model_name: str | None = None,
) -> str:
    system = prompts.chat_system_for_role(role, system_instruction)
    # Flatten history into a single user prompt (stateless, optional memory).
    lines: list[str] = []
    for item in history or []:
        role_name = str(item.get("role") or "user")
        content = str(item.get("content") or "")
        if content:
            lines.append(f"{role_name.upper()}: {content}")
    lines.append(f"USER: {message}")
    lines.append("ASSISTANT:")
    prompt = "\n".join(lines)
    return generate_content(
        user_prompt=prompt,
        system_instruction=system,
        model_name=model_name,
        temperature=0.6,
        response_json=False,
    )


def quality_check_translation(segments: list[dict]) -> dict[str, Any]:
    """
    Review translated segments for serious quality problems.

    Returns {"has_serious_issues": bool, "issues": [{"id", "type", "detail"}]}.
    Never raises on a normal translation; raises GeminiError on API failure.
    """
    if not segments:
        return {"has_serious_issues": False, "issues": []}
    data = generate_json(
        user_prompt=prompts.translation_qa_prompt(segments),
        system_instruction=prompts.TRANSLATION_QA_SYSTEM,
        temperature=0.0,
    )
    issues = [
        i
        for i in (data.get("issues") or [])
        if isinstance(i, dict)
    ]
    return {
        "has_serious_issues": bool(data.get("has_serious_issues")),
        "issues": issues,
    }


def analyze_video(
    *,
    title: str,
    duration: str,
    transcript: str,
    query: str | None,
) -> dict[str, Any]:
    """
    Produce a real video/transcript analysis, summary, title, and description.

    Returns {"analysis", "summary", "title", "description"} with plain strings.
    Raises GeminiError on API failure; the endpoint maps it to a friendly HTTP code.
    """
    data = generate_json(
        user_prompt=prompts.video_analysis_prompt(title, duration, transcript, query),
        system_instruction=prompts.VIDEO_ANALYSIS_SYSTEM,
        temperature=0.3,
    )
    return {
        "analysis": str(data.get("analysis") or "").strip(),
        "summary": str(data.get("summary") or "").strip(),
        "title": str(data.get("title") or "").strip(),
        "description": str(data.get("description") or "").strip(),
    }


def recommend_voice(
    *,
    transcript: str,
    target_language: str | None,
    voices: list[dict],
) -> dict[str, Any]:
    """
    Recommend a voice for dubbing a transcript from a real catalog.

    voices must contain dicts with apiVoiceKey (the only accepted ids).
    The returned id is validated against the catalog: a non-catalog id is
    replaced with None rather than trusted.
    """
    valid_ids = {
        str(v.get("apiVoiceKey")) for v in voices if v.get("apiVoiceKey")
    }
    data = generate_json(
        user_prompt=prompts.voice_recommendation_prompt(
            transcript, target_language, voices
        ),
        system_instruction=prompts.VOICE_RECOMMENDATION_SYSTEM,
        temperature=0.2,
    )
    picked = str(data.get("recommended_voice_id") or "").strip()
    if picked not in valid_ids:
        # Never invent a voice id — Gemini may hallucinate; we do not trust it.
        picked = ""
    return {
        "recommended_voice_id": picked or None,
        "reason": str(data.get("reason") or "").strip(),
        "confidence": data.get("confidence"),
    }


def analyze_transcript(transcript: str) -> dict[str, Any]:
    """Structured transcript analysis (mirrors openai_service.analyze_transcript)."""
    data = generate_json(
        user_prompt=prompts.transcript_analysis_prompt(transcript),
        system_instruction=prompts.TRANSCRIPT_ANALYSIS_SYSTEM,
        temperature=0.2,
    )
    fields = [
        "topic",
        "tone",
        "speaking_style",
        "audience",
        "key_points",
        "unclear_sections",
        "quality",
        "translation_risks",
    ]
    return {f: data.get(f) for f in fields}


def improve_transcript(text: str) -> dict[str, Any]:
    """Improved transcript (mirrors openai_service.improve_transcript)."""
    data = generate_json(
        user_prompt=prompts.transcript_improvement_prompt(text),
        system_instruction=prompts.TRANSCRIPT_IMPROVEMENT_SYSTEM,
        temperature=0.1,
    )
    improved = str(data.get("improved_text") or "").strip()
    if not improved:
        raise GeminiError("Gemini returned an empty improved transcript.", retryable=True)
    return {"improved_text": improved, "changes": ""}


def improve_translation(segments: list[dict]) -> dict[str, Any]:
    """Improved translations per segment (mirrors openai_service.improve_translation)."""
    if not segments:
        return {"segments": [], "summary": "No segments provided."}
    data = generate_json(
        user_prompt=prompts.translation_improvement_prompt(segments),
        system_instruction=prompts.TRANSLATION_IMPROVEMENT_SYSTEM,
        temperature=0.1,
    )
    items = data.get("segments") or []
    by_id: dict[Any, dict] = {
        item.get("id"): item for item in items if isinstance(item, dict)
    }
    out: list[dict] = []
    for seg in segments:
        sid = seg.get("id")
        improved = by_id.get(sid)
        candidate = ""
        note = ""
        if isinstance(improved, dict):
            candidate = str(improved.get("improved_translation") or "").strip()
            note = str(improved.get("note") or "").strip()
        out.append(
            {
                "id": sid,
                "original": seg.get("original") or "",
                "translated": seg.get("translated") or "",
                "improved_translation": candidate or (seg.get("translated") or ""),
                "note": note or ("Unchanged." if not candidate else ""),
            }
        )
    return {"segments": out, "summary": f"Reviewed {len(out)} segment(s)."}


def health_detail() -> dict[str, Any]:
    """Non-secret status for /ready and startup logs."""
    configured = is_configured()
    return {
        "ok": True if configured else True,  # missing key is warning, not hard fail
        "configured": configured,
        "model": resolve_model(),
        "warning": None
        if configured
        else "GEMINI_API_KEY is not set (Gemini translation/chat disabled)",
    }
