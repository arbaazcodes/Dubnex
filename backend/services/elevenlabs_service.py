import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from enum import Enum

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
    TTS_429_MAX_RETRIES,
    TTS_REQUEST_TIMEOUT_SECONDS,
)
from services.elevenlabs_limiter import compute_backoff_seconds, parse_retry_after_seconds
from services.logging_service import get_logger

client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ElevenLabs is not None else None

os.makedirs(OUTPUT_DIR, exist_ok=True)

logger = get_logger("screen_ai.elevenlabs")


class TtsErrorKind(str, Enum):
    RATE_LIMIT = "rate_limit"
    RETRYABLE = "retryable"
    FATAL = "fatal"


class TtsRequestError(Exception):
    """Typed TTS failure for segment workers / callers."""

    def __init__(
        self,
        message: str,
        *,
        kind: TtsErrorKind,
        retry_after: float | None = None,
        cause: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.kind = kind
        self.retry_after = retry_after
        self.__cause__ = cause


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


def _resolve_voice_id(voice: str) -> str:
    voice_key = (voice or "george").strip().lower()
    voice_id = VOICE_MAP.get(voice_key)

    # Allow raw ElevenLabs voice IDs to pass through
    if not voice_id and len(voice_key) >= 20 and voice_key.replace("_", "").isalnum():
        voice_id = voice
    if not voice_id or str(voice_id).startswith("YOUR_"):
        voice_id = DEFAULT_VOICE_ID

    print(f"[ElevenLabs] Using voice key={voice_key!r} voice_id={voice_id!r}")
    return voice_id


def _is_rate_limit_error(exc: BaseException) -> bool:
    """Detect ElevenLabs / HTTP concurrent or rate-limit failures."""
    status = getattr(exc, "status_code", None)
    if status == 429:
        return True
    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) == 429:
        return True
    body = getattr(exc, "body", None)
    blob = f"{exc} {body}".lower()
    return (
        "concurrent_limit_exceeded" in blob
        or "rate_limit" in blob
        or "too many requests" in blob
        or "status_code: 429" in blob
    )


def _http_status(exc: BaseException) -> int | None:
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    if response is not None:
        code = getattr(response, "status_code", None)
        if isinstance(code, int):
            return code
    return None


def classify_tts_error(exc: BaseException) -> TtsErrorKind:
    if isinstance(exc, TtsRequestError):
        return exc.kind
    if isinstance(exc, (TimeoutError, FuturesTimeoutError)):
        return TtsErrorKind.RETRYABLE
    if _is_rate_limit_error(exc):
        return TtsErrorKind.RATE_LIMIT
    status = _http_status(exc)
    if status is not None:
        if status == 429:
            return TtsErrorKind.RATE_LIMIT
        if status >= 500 or status == 408:
            return TtsErrorKind.RETRYABLE
        if 400 <= status < 500:
            return TtsErrorKind.FATAL
    name = type(exc).__name__.lower()
    blob = f"{name} {exc}".lower()
    if any(
        token in blob
        for token in (
            "timeout",
            "timed out",
            "connection reset",
            "connection aborted",
            "temporarily unavailable",
            "service unavailable",
        )
    ):
        return TtsErrorKind.RETRYABLE
    return TtsErrorKind.FATAL


def _synthesize_audio(text: str, voice_id: str):
    """
    Call the installed ElevenLabs SDK.

    SDK 2.x: client.text_to_speech.convert(...) -> Iterator[bytes]
    SDK 1.x: client.generate(...) (deprecated) -> Iterator[bytes]
    """
    # Prefer 2.x API (Docker / current PyPI)
    text_to_speech = getattr(client, "text_to_speech", None)
    if text_to_speech is not None and hasattr(text_to_speech, "convert"):
        return text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id=ELEVENLABS_MODEL,
            output_format="mp3_44100_128",
        )

    # Legacy 1.x fallback
    if hasattr(client, "generate"):
        return client.generate(
            text=text,
            voice=voice_id,
            model=ELEVENLABS_MODEL,
        )

    raise RuntimeError(
        "Unsupported ElevenLabs SDK: neither text_to_speech.convert nor generate is available."
    )


def _collect_audio_bytes(text: str, voice_id: str) -> bytes:
    """Run TTS and fully consume the stream (errors may surface during iteration)."""
    audio = _synthesize_audio(text, voice_id)
    chunks: list[bytes] = []
    for chunk in audio:
        if isinstance(chunk, bytes):
            chunks.append(chunk)
        else:
            chunks.append(bytes(chunk))
    return b"".join(chunks)


def _collect_audio_bytes_timed(text: str, voice_id: str, timeout: float) -> bytes:
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_collect_audio_bytes, text, voice_id)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeoutError as exc:
            future.cancel()
            raise TimeoutError(
                f"ElevenLabs TTS timed out after {timeout:.0f}s"
            ) from exc


def _resolve_output_path(filename: str) -> str:
    if os.path.isabs(filename):
        return filename
    return os.path.join(OUTPUT_DIR, filename)


def synthesize_to_file(
    text: str,
    filepath: str,
    voice: str = "george",
    *,
    timeout: float | None = None,
) -> str:
    """
    Single-attempt TTS write to an absolute or relative path.

    Raises TtsRequestError with kind RATE_LIMIT / RETRYABLE / FATAL.
    Segment workers own multi-attempt retry policy.
    """
    if client is None:
        raise TtsRequestError(
            "ElevenLabs client is unavailable. Install the elevenlabs package and configure ELEVENLABS_API_KEY.",
            kind=TtsErrorKind.FATAL,
        )

    out_path = _resolve_output_path(filepath)
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    voice_id = _resolve_voice_id(voice)
    limit = TTS_REQUEST_TIMEOUT_SECONDS if timeout is None else timeout

    try:
        payload = _collect_audio_bytes_timed(text, voice_id, limit)
        tmp_path = f"{out_path}.tmp"
        with open(tmp_path, "wb") as f:
            f.write(payload)
        os.replace(tmp_path, out_path)
        return out_path
    except Exception as exc:
        kind = classify_tts_error(exc)
        retry_after = parse_retry_after_seconds(exc) if kind == TtsErrorKind.RATE_LIMIT else None
        raise TtsRequestError(
            str(exc),
            kind=kind,
            retry_after=retry_after,
            cause=exc,
        ) from exc


def generate_speech(
    text: str,
    filename: str = "speech.mp3",
    voice: str = "george",
):
    """
    Generate speech using ElevenLabs (single-file helper for API / scripts).

    Retries rate-limit / transient errors with Retry-After + exponential backoff + jitter.
    Segment batch path should prefer synthesize_to_file + tts_service workers.
    """

    if client is None:
        raise RuntimeError(
            "ElevenLabs client is unavailable. Install the elevenlabs package and configure ELEVENLABS_API_KEY."
        )

    filepath = _resolve_output_path(filename)
    last_error: BaseException | None = None

    for attempt in range(0, TTS_429_MAX_RETRIES + 1):
        try:
            return synthesize_to_file(text, filepath, voice=voice)
        except TtsRequestError as exc:
            last_error = exc
            if exc.kind == TtsErrorKind.FATAL:
                raise
            if attempt >= TTS_429_MAX_RETRIES:
                logger.error(
                    "ElevenLabs TTS failed after retries",
                    extra={
                        "event": "elevenlabs_tts_429_exhausted",
                        "retry_number": attempt + 1,
                        "max_retries": TTS_429_MAX_RETRIES,
                        "wait_time_seconds": None,
                        "final_failure_reason": str(exc),
                        "filename": filename,
                        "kind": exc.kind.value,
                    },
                )
                raise

            wait_time = compute_backoff_seconds(attempt, retry_after=exc.retry_after)
            logger.warning(
                "ElevenLabs TTS rate-limited or transient; retrying",
                extra={
                    "event": "elevenlabs_tts_429_retry",
                    "retry_number": attempt + 1,
                    "wait_time_seconds": wait_time,
                    "retry_after": exc.retry_after,
                    "error": str(exc),
                    "filename": filename,
                    "kind": exc.kind.value,
                },
            )
            time.sleep(wait_time)

    assert last_error is not None
    raise last_error
