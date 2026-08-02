# SCREEN.AI — Production Deployment

Deploy the full stack on a Linux server with Docker Compose: **FastAPI**, **React (nginx)**, **PostgreSQL**, and **Redis** (reserved for a future job queue).

## Architecture

```
Browser
  → :80 nginx (frontend)
       ├─ static SPA
       └─ /api /events /process-video …  →  api:8000
  → :8000 optional direct API (debug)
  → :5432 Postgres
  → :6379 Redis
```

## Prerequisites

- Linux server (or Docker Desktop)
- Docker Engine 24+ and Docker Compose v2+
- ~20 GB free disk for images + model cache (first API boot downloads Whisper / NLLB)
- CPU is enough for smoke deploy; GPU optional for production Whisper
- If the repo lives under **OneDrive**, Docker build context may fail (`invalid file request`). Prefer a local path (or “Always keep on this device”) when building images.

## Quick start (from scratch)

```bash
# 1) Clone and enter repo
cd SCREEN.AI

# 2) Create env file
cp .env.docker.example .env.docker
# Edit secrets: POSTGRES_PASSWORD, FIREBASE_*, ELEVENLABS_API_KEY, PUBLIC_BASE_URL, CORS_ORIGINS

# 3) Build and start
docker compose --env-file .env.docker up --build -d

# 4) Watch API become healthy (model load can take several minutes the first time)
docker compose --env-file .env.docker logs -f api

# 5) Probes
curl -fsS http://localhost/healthz          # frontend nginx
curl -fsS http://localhost:8000/health      # API liveness
curl -fsS http://localhost:8000/ready       # API readiness (db, storage, firebase, whisper, redis)
curl -fsS http://localhost:8000/health/detailed
```

Open `http://localhost` (or your `PUBLIC_BASE_URL`).

Stop:

```bash
docker compose --env-file .env.docker down
```

Data volumes (`pgdata`, `redisdata`, `api_outputs`, model cache) persist until:

```bash
docker compose --env-file .env.docker down -v
```

## Services

| Service | Image / build | Role |
|---------|---------------|------|
| `frontend` | `frontend/Dockerfile` | Vite build + nginx reverse proxy |
| `api` | `backend/Dockerfile` | FastAPI + Whisper/NLLB/TTS pipeline |
| `db` | `postgres:16-alpine` | Project metadata (Sprint 11) |
| `redis` | `redis:7-alpine` | Prepared for future queue (`REDIS_URL`) |

## Environment

Primary file: `.env.docker` (from `.env.docker.example`).

Important variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Set automatically in compose to Postgres |
| `REDIS_URL` | `redis://redis:6379/0` |
| `FIREBASE_PROJECT_ID` | Backend token audience |
| `VITE_FIREBASE_*` | Built into the frontend image |
| `STORAGE_PROVIDER` | `local` (volume) or `s3` |
| `WHISPER_*` | Model / device (compose defaults: `tiny` + `cpu`) |
| `STRICT_STARTUP` | `true` to abort API boot if required checks fail |
| `PUBLIC_BASE_URL` / `CORS_ORIGINS` | Public site URL(s) |

Frontend is built with `VITE_API_BASE_URL=""` so the browser talks same-origin through nginx.

## Health endpoints

| Path | Meaning |
|------|---------|
| `GET /health` | Liveness — process up |
| `GET /ready` | Readiness — DB, storage, Firebase config, Whisper loaded (Redis optional) |
| `GET /health/detailed` | Same checks, detailed JSON |
| `GET /healthz` | Frontend nginx only |

Startup logs print `[startup] dependency checks: …` for each component.

## Startup checks

On API boot (`lifespan`):

1. **Database** — `SELECT 1` via SQLAlchemy  
2. **Storage** — local write probe or S3 client/bucket  
3. **Firebase** — `FIREBASE_PROJECT_ID` + `google-auth` import  
4. **Whisper** — model singleton loaded (pipeline unchanged)  
5. **Redis** — ping when `REDIS_URL` set (failure does not block readiness)

With `STRICT_STARTUP=true`, failure of required checks (db / storage / firebase / whisper) stops the process.

## Production notes

- Set strong `POSTGRES_PASSWORD` and real Firebase + ElevenLabs secrets.
- Point `PUBLIC_BASE_URL` and `CORS_ORIGINS` at your HTTPS domain; terminate TLS with a host nginx/Caddy or cloud LB in front of port 80.
- For GPU Whisper: use a CUDA base image / NVIDIA Container Toolkit and set `WHISPER_DEVICE=cuda`, `WHISPER_MODEL=large-v3`, `WHISPER_COMPUTE_TYPE=float16`.
- For cloud MP4s: `STORAGE_PROVIDER=s3` + bucket credentials (Sprint 10).
- Redis is included and checked but **not** used as a job queue yet.

## Local (non-Docker) reminder

Backend: `uvicorn app:app --reload` with `DATABASE_PROVIDER=sqlite` (default).  
Frontend: `npm run dev`.  
Compose is the supported production path on Linux.
