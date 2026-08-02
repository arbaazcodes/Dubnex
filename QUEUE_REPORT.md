# QUEUE_REPORT.md

**Sprint:** 14 — Background Job Queue  
**Date:** 2026-08-02  
**Scope:** Move rendering off the API request thread onto a Redis-backed worker. Reuses `process_video()`. UI, storage, database, and auth unchanged in behavior.

---

## Summary

`POST /process-video` now **enqueues** work and returns immediately:

```json
{ "job_id": "…", "status": "queued", "message": "Processing queued", "queue": "redis"|"inline" }
```

A **worker process** (`python -m worker`) dequeues jobs, calls existing `process_video()`, persists progress to the database (SSE reads it), and applies retries.

| Mode | When | Behavior |
|------|------|----------|
| `redis` | `QUEUE_BACKEND=redis` or `auto` + `REDIS_URL` | Shared Redis list; separate worker |
| `inline` | No Redis / `QUEUE_BACKEND=inline` | Same process, background thread (local/dev) |

---

## Architecture

```
Browser → POST /process-video (auth)
            ↓ save upload under TEMP_DIR/{job_id}.mp4
            ↓ create_job + status=queued
            ↓ LPUSH screen_ai:jobs
            ← { job_id, status: queued }

Worker  → BRPOP screen_ai:jobs
            ↓ process_queued_job()
            ↓ process_video(..., on_progress=update_job)   # unchanged pipeline
            ↓ finish_job / fail_job → DB

Browser → GET /events/{job_id}  (SSE refreshes job from DB each tick)
Dashboard reload → list projects → re-attach SSE for non-terminal jobs
```

### New / updated files

| File | Role |
|------|------|
| `backend/services/queue_service.py` | Enqueue / dequeue / retry helpers |
| `backend/services/job_runner.py` | Runs `process_video` + retries |
| `backend/worker.py` | Worker entrypoint (`python -m worker`) |
| `backend/app.py` | Enqueue on `/process-video`; SSE DB refresh |
| `frontend/src/App.tsx` | Reconnect SSE for running jobs after dashboard load |
| `docker-compose.yml` | `worker` service sharing temp/output volumes |

---

## Retry policy

| Setting | Default |
|---------|---------|
| `JOB_MAX_RETRIES` | `3` |

- Initial attempt = `0`.
- On failure, if `attempt+1 <= JOB_MAX_RETRIES`, job is set back to `status=queued` and re-enqueued.
- Otherwise `fail_job()` → `status=Failed`.
- Upload file is kept across retries; deleted when status is `Completed` or `Failed`.

---

## SSE / reconnect

- SSE uses `get_job(job_id, refresh=True)` so API sees worker DB updates.
- Progress updates without a new stage (e.g. `queued` → `processing`) are re-emitted.
- After login, dashboard loads projects and **re-attaches EventSource** to the newest non-terminal job so a refresh mid-run continues to show progress.

---

## Docker

```yaml
worker:
  command: ["python", "-m", "worker"]
  QUEUE_BACKEND: redis
  REDIS_URL: redis://redis:6379/0
  volumes: api_temp, api_outputs, api_data  # shared with api
```

API and worker must share `TEMP_DIR` (uploads) and `OUTPUT_DIR` (renders).

---

## Configuration

```env
QUEUE_BACKEND=auto          # auto | redis | inline
REDIS_URL=redis://localhost:6379/0
JOB_MAX_RETRIES=3
QUEUE_NAME=screen_ai:jobs
```

---

## Verification

| Check | Result |
|-------|--------|
| Inline enqueue → handler → `Completed` | `INLINE_QUEUE_OK` |
| Redis `LPUSH` / `BRPOP` round-trip | `REDIS_QUEUE_OK` |
| `/process-video` response shape | `status=queued` + `job_id` |
| Pipeline code | Unchanged (`process_video` only called) |

---

## Local run

```bash
# Terminal A — API (inline if no Redis)
uvicorn app:app --reload --port 8000

# With Redis — Terminal B
set REDIS_URL=redis://127.0.0.1:6379/0
set QUEUE_BACKEND=redis
python -m worker
```

Compose: `docker compose --env-file .env.docker up -d` (includes `worker`).

---

## Out of scope

- Multiple specialized queues / priorities
- Dead-letter UI
- Changing Whisper/NLLB/TTS pipeline internals
