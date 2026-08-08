"""
OpenAI chat/analysis client (backend-only).

Reads OPENAI_API_KEY from environment via config. Never logs the key.
Uses the official `openai` SDK with a bounded timeout, bounded retries,
429 handling, and key redaction in error messages.

Translation is NOT routed here — the video pipeline keeps its own
provider facade (translator_service / Gemini / NLLB).
"""

from __future__ import annotations

import json
import re
from typing import Any

from config import (
    OPENAI_API_KEY,
    OPENAI_MAX_RETRIES,
    OPENAI_MAX_OUTPUT_TOKENS,
    OPENAI_MODEL,
    OPENAI_TIMEOUT_SECONDS,
)
from services.logging_service import get_logger
from services import prompt_templates as prompts
from services.ai_provider import resolve_ai_provider

logger = get_logger("screen_ai.openai")

# Imported lazily/defensively so the module imports even without the SDK.
_OpenAI = None
_AuthenticationError = None
_PermissionDeniedError = None
_RateLimitError = None
_APITimeoutError = None
_APIConnectionError = None
_InternalServerError = None
_APIError = None


def _import_sdk():
    global _OpenAI, _AuthenticationError, _PermissionDeniedError
    global _RateLimitError, _APITimeoutError, _APIConnectionError
    global _InternalServerError, _APIError
    if _OpenAI is None:
        import openai as _sdk

        _OpenAI = _sdk.OpenAI
        _AuthenticationError = _sdk.AuthenticationError
        _PermissionDeniedError = _sdk.PermissionDeniedError
        _RateLimitError = _sdk.RateLimitError
        _APITimeoutError = _sdk.APITimeoutError
        _APIConnectionError = _sdk.APIConnectionError
        _InternalServerError = _sdk.InternalServerError
        _APIError = _sdk.APIError


_client = None


class OpenAIError(Exception):
    """Friendly OpenAI failure for API / pipeline callers."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


def is_configured() -> bool:
    return bool(OPENAI_API_KEY)


def resolve_model(model_name: str | None = None) -> str:
    """Map a frontend/legacy label to an OpenAI model, defaulting to OPENAI_MODEL."""
    raw = (model_name or "").strip()
    if not raw:
        return OPENAI_MODEL
    low = raw.lower()
    # Explicit OpenAI model ids pass through.
    if (
        low.startswith(("gpt-", "o1", "o3", "o4", "chatgpt-", "text-"))
        or "-mini" in low
        or "-preview" in low
        or "-turbo" in low
    ):
        return raw
    # Legacy Gemini labels / unknown labels: use the configured OpenAI model.
    return OPENAI_MODEL


def _redact(text: str) -> str:
    if not OPENAI_API_KEY:
        return text
    return text.replace(OPENAI_API_KEY, "[REDACTED]")


def _map_sdk_error(exc: Exception) -> OpenAIError:
    """Translate openai SDK exceptions into a friendly OpenAIError."""
    status = getattr(exc, "status_code", None)
    _import_sdk()
    if _RateLimitError is not None and isinstance(exc, _RateLimitError):
        return OpenAIError(
            "OpenAI rate limit or quota exceeded. Please retry shortly.",
            status_code=429,
            retryable=True,
        )
    if _AuthenticationError is not None and isinstance(exc, _AuthenticationError):
        return OpenAIError(
            "OpenAI authentication failed. Check OPENAI_API_KEY.",
            status_code=401,
            retryable=False,
        )
    if _PermissionDeniedError is not None and isinstance(exc, _PermissionDeniedError):
        return OpenAIError(
            "OpenAI permission denied for the configured model.",
            status_code=403,
            retryable=False,
        )
    if _APITimeoutError is not None and isinstance(exc, _APITimeoutError):
        return OpenAIError(
            "OpenAI request timed out.",
            status_code=504,
            retryable=True,
        )
    if _APIConnectionError is not None and isinstance(exc, _APIConnectionError):
        return OpenAIError(
            "OpenAI network error.",
            status_code=502,
            retryable=True,
        )
    if _InternalServerError is not None and isinstance(exc, _InternalServerError):
        return OpenAIError(
            "OpenAI service is temporarily unavailable.",
            status_code=502,
            retryable=True,
        )
    if status is not None and status == 400:
        return OpenAIError(
            "OpenAI rejected the request (bad parameters or content filter).",
            status_code=400,
            retryable=False,
        )
    return OpenAIError(
        f"OpenAI request failed ({getattr(exc, '__class__', type(exc)).__name__}).",
        status_code=status if isinstance(status, int) else None,
        retryable=False,
    )


def _get_client():
    """Lazily build the OpenAI client (timeout + bounded retries from config)."""
    global _client
    if _client is None:
        _import_sdk()
        _client = _OpenAI(
            api_key=OPENAI_API_KEY,
            timeout=OPENAI_TIMEOUT_SECONDS,
            max_retries=OPENAI_MAX_RETRIES,
        )
    return _client


def reset_client() -> None:
    """Drop the cached client (used by tests)."""
    global _client
    _client = None


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
    raise OpenAIError("OpenAI returned invalid JSON.", retryable=True)


def generate_content(
    *,
    user_prompt: str,
    system_instruction: str | None = None,
    model_name: str | None = None,
    temperature: float = 0.2,
    response_json: bool = False,
) -> str:
    """
    Execute an OpenAI chat completion with SDK-managed retries.
    Raises OpenAIError on terminal failure.
    """
    if not is_configured():
        raise OpenAIError(
            "OpenAI is not configured. Set OPENAI_API_KEY in the backend environment.",
            status_code=503,
            retryable=False,
        )

    model = resolve_model(model_name)
    messages: list[dict[str, str]] = []
    if system_instruction and system_instruction.strip():
        messages.append({"role": "system", "content": system_instruction.strip()})
    messages.append({"role": "user", "content": user_prompt})

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_json:
        kwargs["response_format"] = {"type": "json_object"}
    if OPENAI_MAX_OUTPUT_TOKENS > 0:
        kwargs["max_tokens"] = OPENAI_MAX_OUTPUT_TOKENS

    try:
        client = _get_client()
        resp = client.chat.completions.create(**kwargs)
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            raise OpenAIError("OpenAI returned empty content.", retryable=True)
        return text
    except OpenAIError:
        raise
    except Exception as exc:  # SDK exceptions
        mapped = _map_sdk_error(exc)
        logger.error(
            "OpenAI request failed",
            extra={
                "event": "openai_error",
                "error_type": getattr(exc, "__class__", type(exc)).__name__,
                "model": model,
                "error": _redact(str(mapped)),
            },
        )
        raise mapped


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


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


def chat(
    message: str,
    *,
    history: list[dict] | None = None,
    system_instruction: str | None = None,
    role: str | None = None,
    model_name: str | None = None,
) -> str:
    system = prompts.chat_system_for_role(role, system_instruction)
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    for item in history or []:
        role_name = str(item.get("role") or "user")
        content = str(item.get("content") or "")
        if content:
            normalized = "assistant" if role_name.lower() == "assistant" else "user"
            messages.append({"role": normalized, "content": content})
    messages.append({"role": "user", "content": message})
    # Rebuild user_prompt via the flat prompt used by Gemini so both providers
    # accept the same request/response contract.
    prompt = _flatten_chat_prompt(message, history, system)
    return generate_content(
        user_prompt=prompt,
        system_instruction=system,
        model_name=model_name,
        temperature=0.6,
        response_json=False,
    )


def _flatten_chat_prompt(
    message: str, history: list[dict] | None = None, system: str | None = None
) -> str:
    """Mirror gemini_service's stateless prompt so behavior is consistent."""
    lines: list[str] = []
    if system:
        lines.append(f"SYSTEM: {system}")
    for item in history or []:
        role_name = str(item.get("role") or "user")
        content = str(item.get("content") or "")
        if content:
            lines.append(f"{role_name.upper()}: {content}")
    lines.append(f"USER: {message}")
    lines.append("ASSISTANT:")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Video / content analysis (mirrors gemini_service.analyze_video)
# ---------------------------------------------------------------------------


def analyze_video(
    *,
    title: str,
    duration: str,
    transcript: str,
    query: str | None,
) -> dict[str, Any]:
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


# ---------------------------------------------------------------------------
# Transcript analysis (structured)
# ---------------------------------------------------------------------------


def analyze_transcript(transcript: str) -> dict[str, Any]:
    """Structured transcript analysis: topic, tone, style, audience, points,
    unclear sections, quality, and translation risks."""
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
    out: dict[str, Any] = {}
    for f in fields:
        out[f] = data.get(f)
    return out


# ---------------------------------------------------------------------------
# Transcript improvement (grammar / punctuation / readability)
# ---------------------------------------------------------------------------


def improve_transcript(text: str) -> dict[str, Any]:
    """Return an improved transcript (preserving meaning/names/numbers/terms)."""
    data = generate_json(
        user_prompt=prompts.transcript_improvement_prompt(text),
        system_instruction=prompts.TRANSCRIPT_IMPROVEMENT_SYSTEM,
        temperature=0.1,
    )
    improved = str(data.get("improved_text") or "").strip()
    if not improved:
        raise OpenAIError("OpenAI returned an empty improved transcript.", retryable=True)
    return {
        "improved_text": improved,
        "changes": _summarize_changes(text, improved),
    }


def _summarize_changes(original: str, improved: str) -> str:
    """Short, human-readable change summary (not a full diff)."""
    o_words = len(original.split())
    i_words = len(improved.split())
    delta = i_words - o_words
    if delta == 0:
        return "Word count unchanged."
    return f"Word count {'+' if delta > 0 else ''}{delta} ({o_words} → {i_words})."


# ---------------------------------------------------------------------------
# Translation improvement (checks semantic accuracy, grammar, naturalness,
# missing/extra content, names, numbers, technical terms)
# ---------------------------------------------------------------------------


def improve_translation(segments: list[dict]) -> dict[str, Any]:
    """Return improved translations per segment with a note per segment."""
    if not segments:
        return {"segments": [], "summary": "No segments provided."}
    data = generate_json(
        user_prompt=prompts.translation_improvement_prompt(segments),
        system_instruction=prompts.TRANSLATION_IMPROVEMENT_SYSTEM,
        temperature=0.1,
    )
    items = data.get("segments") or []
    by_id: dict[Any, dict] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        sid = item.get("id")
        by_id[sid] = item

    out: list[dict] = []
    for seg in segments:
        sid = seg.get("id")
        note = ""
        improved = by_id.get(sid)
        if isinstance(improved, dict):
            candidate = str(improved.get("improved_translation") or "").strip()
            if candidate:
                out.append(
                    {
                        "id": sid,
                        "original": seg.get("original") or "",
                        "translated": seg.get("translated") or "",
                        "improved_translation": candidate,
                        "note": str(improved.get("note") or "").strip(),
                    }
                )
                continue
            note = str(improved.get("note") or "").strip()
        out.append(
            {
                "id": sid,
                "original": seg.get("original") or "",
                "translated": seg.get("translated") or "",
                "improved_translation": seg.get("translated") or "",
                "note": note or "Unchanged.",
            }
        )
    return {"segments": out, "summary": f"Reviewed {len(out)} segment(s)."}


# ---------------------------------------------------------------------------
# Voice recommendation (validated against the real catalog)
# ---------------------------------------------------------------------------


def recommend_voice(
    *,
    transcript: str,
    target_language: str | None,
    voices: list[dict],
) -> dict[str, Any]:
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
        # Never invent a voice id — the model may hallucinate; we do not trust it.
        picked = ""
    return {
        "recommended_voice_id": picked or None,
        "reason": str(data.get("reason") or "").strip(),
        "confidence": data.get("confidence"),
    }


def health_detail() -> dict[str, Any]:
    configured = is_configured()
    return {
        "ok": True,
        "configured": configured,
        "provider": resolve_ai_provider(),
        "model": OPENAI_MODEL,
        "warning": None
        if configured
        else "OPENAI_API_KEY is not set (OpenAI chat/analysis disabled)",
    }
