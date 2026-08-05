# Dubnex

Production-oriented AI dubbing stack:

- **Frontend:** React + Vite (Firebase Auth)
- **Backend:** FastAPI (Whisper → Translation → ElevenLabs TTS → FFmpeg render)
- **Translation:** Google Gemini (preferred when `GEMINI_API_KEY` is set) or local NLLB
- **Chat:** Gemini-backed `/api/chat` (API key stays on the backend)

## Security

- **Never** put `GEMINI_API_KEY` in frontend `VITE_*` variables.
- Store secrets only in `backend/.env` (see `backend/.env.example`).
- The API key is sent only from the FastAPI process to Google.

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .\.venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
# Set GEMINI_API_KEY, ELEVENLABS_API_KEY, FIREBASE_PROJECT_ID, etc.
uvicorn app:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_BASE_URL=http://127.0.0.1:8000 and Firebase VITE_* keys
npm run dev
```

## Gemini configuration

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Backend-only Google AI Studio / Gemini key |
| `GEMINI_MODEL` | Default model (e.g. `gemini-2.0-flash`) |
| `TRANSLATION_PROVIDER` | `auto` \| `gemini` \| `nllb` |
| `GEMINI_CLEANUP_TRANSCRIPT` | Optional Whisper punctuation cleanup |

`TRANSLATION_PROVIDER=auto` uses Gemini when the key is present, otherwise NLLB.

## Key API routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | Liveness |
| GET | `/ready` | Dependency checks (Gemini optional) |
| POST | `/api/chat` | Gemini chat |
| POST | `/api/translate` | Text translation (Gemini or NLLB) |
| POST | `/process-video` | Full dubbing job (auth required) |

## Tests

```bash
cd backend
pytest tests -q
```
