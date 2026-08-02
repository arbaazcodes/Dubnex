# TEST_REPORT.md — Sprint 16 Automated Test Suite

**Date:** 2026-08-02  
**Status:** Green (all suites passing)

## Summary

| Suite | Passed | Failed | Notes |
|-------|--------|--------|-------|
| Backend unit | 20 | 0 | Whisper, translator, storage, auth, queue |
| Backend integration | 3 | 0 | Upload → queue → worker, DB, storage |
| Backend API | 5 | 0 | Health, login/auth gate, projects, stream/download |
| Backend failure | 6 | 0 | Invalid file, Redis/DB/storage missing, worker crash |
| Backend perf regression | 2 | 0 | TTS concurrency, queue wait |
| Frontend component (Vitest) | 4 | 0 | API helpers, TranscriptEditor |
| Frontend E2E (Playwright) | 4 | 0 | Login, upload, processing/preview/download, dashboard (stubbed) |
| **Total** | **44** | **0** | |

## Coverage (backend)

Measured with `python -m coverage run -m pytest tests` then `coverage report --include="services/*,app.py"`:

| Area | Cover |
|------|-------|
| **TOTAL (services + app.py)** | **67%** (1971 stmts, 655 miss) |
| `project_models.py` | 100% |
| `logging_service.py` | 98% |
| `firebase_auth.py` | 87% |
| `job_runner.py` | 85% |
| `job_service.py` | 84% |
| `db.py` | 89% |
| `translator_service.py` | 76% |
| `queue_service.py` | 73% |
| `storage_service.py` | 55% |
| `app.py` | 50% |

Heavy pipeline modules (`pipeline_service`, TTS, FFmpeg stitch/render) remain lightly covered by design: CI stubs Whisper/ElevenLabs and mocks `process_video` so tests stay fast and do not require GPU/API keys.

Whisper **unit tests** assert the service contract (`model` present, `transcribe_audio`, `detect_language`) against a deterministic stub installed in `tests/conftest.py`.

## How to run

### Backend

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests
# coverage:
python -m coverage run -m pytest tests
python -m coverage report --include="services/*,app.py"
```

### Frontend (component)

```bash
cd frontend
npm install
npm test
```

### Frontend (E2E)

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

E2E uses Playwright’s built-in Vite preview webServer and stubs `/api/projects` so flows do not depend on Firebase OAuth or a live API. Real Google sign-in is not automated (browser OAuth).

## Suite map

### Backend unit (`tests/unit/`)

| File | Focus |
|------|--------|
| `test_whisper_service.py` | Transcription + language detection contract |
| `test_translator_service.py` | Translate text/segments, unsupported lang, empty batch |
| `test_storage_service.py` | Local upload/exists/delete, path traversal, persist |
| `test_auth.py` | Bearer/query token extract, verify valid/invalid |
| `test_queue.py` | Inline vs Redis resolve, retry policy, enqueue/dequeue |

### Backend integration (`tests/integration/`)

- Upload → enqueue → worker (mocked pipeline) → DB job status  
- Project list from database  
- Storage persist of rendered output  

### Backend API (`tests/api/`)

- `GET /health`  
- Projects require auth  
- Authed token path (login gate)  
- Project detail + delete  
- Stream + download redirects/URLs  

### Backend failure (`tests/failure/`)

- Invalid / empty upload  
- Missing Redis (fallback or controlled error)  
- Missing DB health check failure  
- Missing S3 bucket / storage misconfig  
- Worker crash → retries → failed  

### Performance regression (`tests/test_perf_regression.py`)

| Check | Assertion |
|-------|-----------|
| TTS concurrency | Concurrent I/O-bound work (`limit=3`) finishes in **&lt; 70%** of sequential time |
| Queue wait | `_queue_wait_seconds` returns non-negative wait ≥ ~0.4s for a past `enqueued_at` |

These are lightweight guards (no full Whisper/NLLB/TTS pipeline). They catch accidental sequentialization or broken queue-wait accounting without flaking on machine load.

### Frontend

| Layer | Location | Coverage |
|-------|----------|----------|
| Component / unit | `src/services/api.test.ts`, `src/components/chat/TranscriptEditor.test.tsx` | Auth header helpers; transcript edit/save |
| E2E | `e2e/app-flows.spec.ts` | Login CTA, upload surface, processing/preview/download vocabulary, dashboard shell |

## Verdict

All automated suites are **green**: **44 passed, 0 failed**. Backend line coverage on core services/app is **67%**. Performance regression checks for concurrency and queue wait are included and passing.
