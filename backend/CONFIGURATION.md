# Configuration

Secrets and service settings live in **`backend/.env`** (never in the frontend).

Copy from `backend/.env.example` and fill values for your environment.

## Google Gemini

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `GEMINI_API_KEY` | For Gemini features | _(empty)_ | Backend only. Missing key logs a startup **warning**; process still starts. |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Default model for chat / translation |
| `TRANSLATION_PROVIDER` | No | `auto` | `auto` → Gemini if key set, else NLLB; or force `gemini` / `nllb` |
| `GEMINI_CLEANUP_TRANSCRIPT` | No | `false` | Optional Whisper punctuation/grammar cleanup |
| `GEMINI_TIMEOUT_SECONDS` | No | `60` | Per-request timeout |
| `GEMINI_MAX_RETRIES` | No | `3` | Retries for 429 / 5xx / network |
| `GEMINI_BACKOFF_*` | No | see `.env.example` | Exponential backoff + jitter; honors `Retry-After` |

### Security rules

- Do **not** set `VITE_GEMINI_API_KEY` or any frontend env with the Gemini key.
- Do **not** commit `backend/.env`.
- Chat and translation call Google from FastAPI only (`/api/chat`, `/api/translate`, pipeline).

### Health

- `GET /health` — liveness
- `GET /ready` — dependency report; Gemini is **optional** (warn when unset)
