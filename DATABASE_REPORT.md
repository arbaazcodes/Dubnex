# DATABASE_REPORT.md

**Sprint:** 11 — Production Database  
**Date:** 2026-08-02  
**Scope:** Durable project/job metadata in a real database. AI pipeline and UI unchanged. Storage provider abstraction unchanged.

---

## Audit (before)

| Layer | Mechanism | Survives restart? |
|-------|-----------|-------------------|
| Backend jobs | In-memory `jobs` dict (`job_service.py`) | No |
| Output paths | `outputs/.registry/{id}.json` | Yes (filename / storage key only) |
| Frontend cache | `localStorage` + optional Firestore helpers | Partial / client-only |
| Dashboard load | `GET /api/projects` then Firestore/localStorage fallback | API list was registry + memory |

Missing from durable storage: transcript, timeline, logs, processing time, models, full status history.

---

## Summary

Project metadata now lives in a **SQLAlchemy-backed database** (SQLite by default for local/offline; PostgreSQL via env for production).

In-memory `jobs` remains a hot cache for SSE / active processing. Every create / update / finish / fail **upserts** the full project row. `get_job` hydrates from the DB after process restart. Dashboard `GET /api/projects` reads from the database.

Object storage (`STORAGE_PROVIDER` / signed URLs) is untouched — the DB stores `videoUrl`, `downloadUrl`, `storage_provider`, and `storage_key` only.

---

## Architecture

```
create_job / update_job / finish_job / fail_job
        ↓
  in-memory jobs (SSE)
        ↓
  project_repository.upsert_project()
        ↓
  SQLite file  OR  PostgreSQL
        ↓
GET /api/projects  →  Dashboard
GET /api/projects/{id}  →  full detail
get_job()  →  memory, else DB hydrate
```

### New modules

| File | Role |
|------|------|
| `backend/services/db.py` | Engine, sessions, `init_db()` |
| `backend/services/project_models.py` | `projects` ORM table |
| `backend/services/project_repository.py` | Upsert / get / list / delete + registry import |

### Stored fields

| Requirement | Column / JSON |
|-------------|----------------|
| owner UID | `owner_id` |
| project | `id`, `title`, languages, timestamps |
| status | `status`, `stage`, `progress`, `message` |
| transcript | `transcript_json` |
| timeline | `timeline_json` (timed segments; mirrors transcript at finish) |
| logs | `logs_json` |
| output URL | `video_url`, `download_url` (+ `storage_key` / `storage_provider`) |
| processing time | `processing_time`, `processing_time_ms` |
| models | `translation_model`, `tts_model` (+ `metadata_json`) |
| selected voice | `voice` |

Also: duration, size, resolution, fps, stage history/timings, optional renders/versions stubs.

---

## Configuration

In `backend/.env.example`:

```env
DATABASE_PROVIDER=sqlite          # sqlite | postgres | memory
DATABASE_URL=                     # required for postgres
DATA_DIR=data                     # SQLite file: data/screen_ai.db
```

| Provider | Behavior |
|----------|----------|
| `sqlite` (default) | File DB under `backend/data/screen_ai.db` — offline-friendly |
| `postgres` | Set `DATABASE_URL=postgresql+psycopg://…` (install `psycopg`) |
| `memory` | Ephemeral in-process SQLite (no durable file) |

Dependency: `sqlalchemy` in `backend/requirements.txt`.

---

## API / Dashboard

| Endpoint | Change |
|----------|--------|
| `GET /api/projects` | Lists from DB (merge active in-memory jobs); includes transcript, timeline, logs |
| `GET /api/projects/{id}` | New: full project for owner |
| `DELETE /api/projects/{id}` | Deletes DB row + memory + storage registry/file |

Frontend (`App.tsx`) maps `transcript` / `logs` from the API into Dashboard state (no UI redesign). localStorage remains a cache; API/DB is source of truth when signed in.

On first durable DB init, existing `outputs/.registry/*.json` records are imported (metadata only; transcript may be empty for historical jobs).

---

## Verification

| Check | Result |
|-------|--------|
| Create → finish → clear memory → `get_job` hydrate | Pass |
| List by owner includes transcript / voice | Pass |
| Delete removes DB row | Pass |
| Default provider | `sqlite`, durable |
| Pipeline / storage service | Unchanged |

---

## How to use

**Local / offline (default):** leave `DATABASE_PROVIDER=sqlite`.

**Production Postgres:**

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql+psycopg://USER:PASS@HOST:5432/screen_ai
```

```bash
pip install sqlalchemy psycopg[binary]
```

Restart the API. New dubbing jobs persist across restarts; Dashboard loads from the DB.

---

## Out of scope / follow-ups

- Syncing client-side transcript edits back to the DB (save endpoint)
- Replacing the file output registry entirely (still used for media path / storage delete)
- Multi-tenant admin queries / analytics warehouse
