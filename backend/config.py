import os
from dotenv import load_dotenv

# Load .env file from backend directory
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _path_from_env(key: str, default_name: str) -> str:
    value = os.getenv(key, "").strip()
    if not value:
        return os.path.join(BASE_DIR, default_name)
    if os.path.isabs(value):
        return value
    return os.path.join(BASE_DIR, value)


# Server / public URL (used for CORS, SSE video links, static mounts)
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", f"http://{HOST}:{PORT}").rstrip("/")

# Directories
TEMP_DIR = _path_from_env("TEMP_DIR", "temp")
OUTPUT_DIR = _path_from_env("OUTPUT_DIR", "outputs")

os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# CORS (comma-separated origins)
_CORS_DEFAULT = ",".join(
    [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", _CORS_DEFAULT).split(",")
    if origin.strip()
]

# Whisper Settings
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")
DEVICE = os.getenv("WHISPER_DEVICE", "cuda")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")

# Translation
TRANSLATION_MODEL = os.getenv(
    "TRANSLATION_MODEL",
    "facebook/nllb-200-distilled-600M",
)
# Translation backend: auto (Gemini when GEMINI_API_KEY set, else NLLB) | gemini | nllb
TRANSLATION_PROVIDER = (
    os.getenv("TRANSLATION_PROVIDER", "auto").strip().lower() or "auto"
)

# AI provider for chat / analysis / improvement features: auto | openai | gemini
#   auto    — OpenAI when OPENAI_API_KEY is set, else Gemini when GEMINI_API_KEY is set
#   openai  — always OpenAI (chat/analysis/improvement)
#   gemini  — always Gemini (chat/analysis/improvement)
AI_PROVIDER = (os.getenv("AI_PROVIDER", "auto").strip().lower() or "auto")

# OpenAI (backend-only — never expose to frontend / VITE_*)
OPENAI_API_KEY = (os.getenv("OPENAI_API_KEY") or "").strip()
OPENAI_MODEL = (os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = max(5.0, float(os.getenv("OPENAI_TIMEOUT_SECONDS", "60")))
OPENAI_MAX_RETRIES = max(0, int(os.getenv("OPENAI_MAX_RETRIES", "2")))
# Cap on generated output tokens (cost control). 0 = SDK default.
OPENAI_MAX_OUTPUT_TOKENS = max(0, int(os.getenv("OPENAI_MAX_OUTPUT_TOKENS", "2048")))

# Google Gemini (backend-only — never expose to frontend / VITE_*)
GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (
    os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
)
GEMINI_CLEANUP_TRANSCRIPT = os.getenv(
    "GEMINI_CLEANUP_TRANSCRIPT", "false"
).strip().lower() in ("1", "true", "yes", "on")
# Translation quality check (Gemini) after translation; retries once on serious issues.
GEMINI_TRANSLATION_QA = os.getenv(
    "GEMINI_TRANSLATION_QA", "true"
).strip().lower() in ("1", "true", "yes", "on")
GEMINI_TIMEOUT_SECONDS = max(5.0, float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60")))
GEMINI_MAX_RETRIES = max(0, int(os.getenv("GEMINI_MAX_RETRIES", "3")))
GEMINI_BACKOFF_BASE_SECONDS = max(0.0, float(os.getenv("GEMINI_BACKOFF_BASE_SECONDS", "1")))
GEMINI_BACKOFF_MAX_SECONDS = max(
    GEMINI_BACKOFF_BASE_SECONDS,
    float(os.getenv("GEMINI_BACKOFF_MAX_SECONDS", "30")),
)
GEMINI_BACKOFF_JITTER_RATIO = max(
    0.0,
    min(1.0, float(os.getenv("GEMINI_BACKOFF_JITTER_RATIO", "0.25"))),
)

# Coqui TTS (XTTS v2) - Local/Free TTS
# XTTS v2 supports: en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh, ja, hu, ko, hi
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "coqui").strip().lower() or "coqui"
TTS_MODEL = os.getenv("TTS_MODEL", "tts_models/multilingual/multi-dataset/xtts_v2")
TTS_DEVICE = os.getenv("TTS_DEVICE", "cpu")  # cuda or cpu
TTS_LANGUAGE = os.getenv("TTS_LANGUAGE", "en")  # Default language
TTS_SPEAKER_WAV = os.getenv("TTS_SPEAKER_WAV", "")  # Optional reference speaker for voice cloning
TTS_SPEED = max(0.5, min(2.0, float(os.getenv("TTS_SPEED", "1.0"))))  # 0.5 to 2.0

# TTS Concurrency (for local generation - be conservative with CPU)
TTS_CONCURRENCY = max(1, int(os.getenv("TTS_CONCURRENCY", "1")))
TTS_CONCURRENCY_MIN = max(1, min(TTS_CONCURRENCY, int(os.getenv("TTS_CONCURRENCY_MIN", "1"))))
TTS_REQUEST_TIMEOUT_SECONDS = max(1.0, float(os.getenv("TTS_REQUEST_TIMEOUT_SECONDS", "300")))

# Fail process start when required startup checks fail (recommended in production)
STRICT_STARTUP = os.getenv("STRICT_STARTUP", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# --- API rate limiting (per-user + per-IP) ---
# Process-local fixed-window budgets applied to paid / resource-heavy endpoints.
# Single-replica deployments keep counters in-process. For multi-replica
# production, swap the store in services/rate_limit.py for Redis using the same
# interface — budgets stay configured here via env.
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
RATE_LIMIT_WINDOW_SECONDS = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")))
RATE_LIMIT_MAX_PER_USER = max(1, int(os.getenv("RATE_LIMIT_MAX_PER_USER", "60")))
RATE_LIMIT_MAX_PER_IP = max(1, int(os.getenv("RATE_LIMIT_MAX_PER_IP", "120")))

# --- Security hardening: request/upload caps + protected-ops auth ---
# Paid/resource-heavy payloads are capped to bound cost + abuse. Reject, don't truncate.
MAX_TEXT_LENGTH = max(1, int(os.getenv("MAX_TEXT_LENGTH", "50000")))
MAX_CHAT_MESSAGE_LENGTH = max(1, int(os.getenv("MAX_CHAT_MESSAGE_LENGTH", "10000")))
MAX_CHAT_HISTORY_ITEMS = max(1, int(os.getenv("MAX_CHAT_HISTORY_ITEMS", "50")))
MAX_CHAT_INSTRUCTION_LENGTH = max(1, int(os.getenv("MAX_CHAT_INSTRUCTION_LENGTH", "4000")))
MAX_TRANSCRIBE_PAYLOAD_BYTES = max(
    1, int(os.getenv("MAX_TRANSCRIBE_PAYLOAD_BYTES", str(8 * 1024 * 1024)))
)
MAX_RENDER_UPLOAD_BYTES = max(
    1, int(os.getenv("MAX_RENDER_UPLOAD_BYTES", str(200 * 1024 * 1024)))
)
MAX_DETECT_FILENAME_LENGTH = max(1, int(os.getenv("MAX_DETECT_FILENAME_LENGTH", "255")))
# When set, /metrics accepts this bearer token (for Prometheus scrapers) in
# addition to a Firebase ID token. Empty = Firebase auth only.
METRICS_TOKEN = (os.getenv("METRICS_TOKEN") or "").strip()

