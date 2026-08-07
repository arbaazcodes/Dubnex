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

# Google Gemini (backend-only — never expose to frontend / VITE_*)
GEMINI_API_KEY = (os.getenv("GEMINI_API_KEY") or "").strip()
GEMINI_MODEL = (
    os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip() or "gemini-2.0-flash"
)
GEMINI_CLEANUP_TRANSCRIPT = os.getenv(
    "GEMINI_CLEANUP_TRANSCRIPT", "false"
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

# ElevenLabs
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_MODEL = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")

# Firebase (ID token audience / project id)
FIREBASE_PROJECT_ID = os.getenv(
    "FIREBASE_PROJECT_ID",
    os.getenv("VITE_FIREBASE_PROJECT_ID", ""),
).strip()

# Project metadata database
# DATABASE_PROVIDER=sqlite|postgres|memory
#   sqlite   — local file DB (default, offline-friendly)
#   postgres — production (requires DATABASE_URL)
#   memory   — no durable DB (in-memory jobs + file registry only)
DATABASE_PROVIDER = os.getenv("DATABASE_PROVIDER", "sqlite").strip().lower() or "sqlite"
_DATA_DIR = _path_from_env("DATA_DIR", "data")
os.makedirs(_DATA_DIR, exist_ok=True)
_DEFAULT_SQLITE_URL = "sqlite:///" + os.path.join(_DATA_DIR, "screen_ai.db").replace("\\", "/")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    if DATABASE_PROVIDER == "postgres":
        DATABASE_URL = ""  # must be set explicitly for postgres
    elif DATABASE_PROVIDER == "memory":
        DATABASE_URL = "sqlite:///:memory:"
    else:
        DATABASE_URL = _DEFAULT_SQLITE_URL

# Object storage (local for development, s3 for cloud)
# STORAGE_PROVIDER=local|s3
STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local").strip().lower() or "local"
S3_BUCKET = os.getenv("S3_BUCKET", "").strip()
S3_REGION = os.getenv("S3_REGION", "us-east-1").strip() or "us-east-1"
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "").strip()
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "").strip()  # MinIO / R2 / custom
S3_PREFIX = os.getenv("S3_PREFIX", "screen-ai").strip().strip("/") or "screen-ai"
S3_SIGNED_URL_EXPIRY = int(os.getenv("S3_SIGNED_URL_EXPIRY", "3600"))
# When using s3, delete local rendered MP4 after successful upload
STORAGE_DELETE_LOCAL_AFTER_UPLOAD = os.getenv(
    "STORAGE_DELETE_LOCAL_AFTER_UPLOAD", "true"
).strip().lower() in ("1", "true", "yes", "on")

# ElevenLabs Default Voices
DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_DEFAULT_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")

# Redis (job queue + future features)
REDIS_URL = os.getenv("REDIS_URL", "").strip()
# auto = Redis when REDIS_URL set, else in-process inline fallback
QUEUE_BACKEND = os.getenv("QUEUE_BACKEND", "auto").strip().lower() or "auto"
JOB_MAX_RETRIES = max(0, int(os.getenv("JOB_MAX_RETRIES", "3")))
QUEUE_NAME = os.getenv("QUEUE_NAME", "screen_ai:jobs").strip() or "screen_ai:jobs"
QUEUE_BRPOP_TIMEOUT = int(os.getenv("QUEUE_BRPOP_TIMEOUT", "5"))

# Performance tuning (does not change pipeline stage order / outputs schema)
# Default 1 avoids ElevenLabs concurrent_limit_exceeded on low-concurrency plans.
# Raise via env when the account allows more parallel TTS requests.
TTS_CONCURRENCY = max(1, int(os.getenv("TTS_CONCURRENCY", "1")))
# Adaptive TTS limiter (Phase 1): ceiling is TTS_CONCURRENCY; floor is TTS_CONCURRENCY_MIN.
TTS_CONCURRENCY_MIN = max(1, min(TTS_CONCURRENCY, int(os.getenv("TTS_CONCURRENCY_MIN", "1"))))
TTS_429_MAX_RETRIES = max(0, int(os.getenv("TTS_429_MAX_RETRIES", "5")))
TTS_BACKOFF_BASE_SECONDS = max(0.0, float(os.getenv("TTS_BACKOFF_BASE_SECONDS", "1")))
TTS_BACKOFF_MAX_SECONDS = max(
    TTS_BACKOFF_BASE_SECONDS,
    float(os.getenv("TTS_BACKOFF_MAX_SECONDS", "60")),
)
TTS_BACKOFF_JITTER_RATIO = max(
    0.0,
    min(1.0, float(os.getenv("TTS_BACKOFF_JITTER_RATIO", "0.25"))),
)
TTS_REQUEST_TIMEOUT_SECONDS = max(1.0, float(os.getenv("TTS_REQUEST_TIMEOUT_SECONDS", "120")))
TTS_ADAPTIVE_ENABLED = os.getenv("TTS_ADAPTIVE_ENABLED", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
TTS_DOWNGRADE_THRESHOLD = max(1, int(os.getenv("TTS_DOWNGRADE_THRESHOLD", "2")))
TTS_RECOVERY_SUCCESS_STREAK = max(1, int(os.getenv("TTS_RECOVERY_SUCCESS_STREAK", "5")))
TRANSLATION_BATCH_SIZE = max(1, int(os.getenv("TRANSLATION_BATCH_SIZE", "8")))
WHISPER_WARMUP = os.getenv("WHISPER_WARMUP", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)
PERF_PROFILE = os.getenv("PERF_PROFILE", "true").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# Fail process start when required startup checks fail (recommended in production)
STRICT_STARTUP = os.getenv("STRICT_STARTUP", "false").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

# Keys match Voice Library apiVoiceKey values (env overrides supported)
VOICE_MAP = {
    "george": os.getenv("ELEVENLABS_VOICE_GEORGE", DEFAULT_VOICE_ID),
    "bunty": os.getenv("ELEVENLABS_VOICE_BUNTY", "YOUR_BUNTY_VOICE_ID"),
    "jessica": os.getenv("ELEVENLABS_VOICE_JESSICA", "YOUR_JESSICA_VOICE_ID"),
    "bella": os.getenv("ELEVENLABS_VOICE_BELLA", "EXAVITQu4vr4xnSDxMaL"),
    "adam": os.getenv("ELEVENLABS_VOICE_ADAM", "pNInz6obpgDQGcFmaJgB"),
    "rachel": os.getenv("ELEVENLABS_VOICE_RACHEL", "21m00Tcm4TlvDq8ikWAM"),
    "serena": os.getenv("ELEVENLABS_VOICE_SERENA", "XB0fDUnXU5powFXDhCwa"),
    "marcus": os.getenv("ELEVENLABS_VOICE_MARCUS", "VR6AewLTigWG4xSOukaG"),
    "aria": os.getenv("ELEVENLABS_VOICE_ARIA", "9BWtsMINqrJLrRacOk9x"),
    "daniel": os.getenv("ELEVENLABS_VOICE_DANIEL", "onwK4e9ZLuTAKqWW03F9"),
}

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

