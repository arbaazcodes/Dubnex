# DEPLOYMENT_REPORT.md

**Sprint:** 12 — Production Deployment  
**Date:** 2026-08-02  
**Scope:** Dockerize FastAPI, frontend, PostgreSQL, Redis; health/startup checks; verify clean compose bring-up. AI pipeline and UI unchanged.

---

## Summary

SCREEN.AI deploys on a production Linux host with **Docker Compose**. All services verified healthy; no container restart required for this report.

| Service | Role | Status |
|---------|------|--------|
| `frontend` | nginx + SPA; reverse-proxies API | Healthy (`:8080`) |
| `api` | FastAPI + models | Healthy (`:8000`) |
| `db` | PostgreSQL 16 | Healthy (`:5432`) |
| `redis` | Redis 7 (future queue) | Healthy (`:6379`) |

Guide: [`DEPLOYMENT.md`](DEPLOYMENT.md)

---

## Verification (no restart)

`docker compose -p screenai ps` — all four services **Up (healthy)**.

| Check | Command / probe | Result |
|-------|-----------------|--------|
| Frontend reachable | `GET http://127.0.0.1:8080/healthz` | **HTTP 200** (`ok`) |
| Frontend SPA | `GET http://127.0.0.1:8080/` | **HTTP 200** |
| Backend reachable | `GET http://127.0.0.1:8080/health` (nginx → api) | **HTTP 200** `{"status":"ok","service":"screen-ai-api"}` |
| Backend readiness | `GET http://127.0.0.1:8080/ready` | **HTTP 200** `ok: true` |
| Database | `pg_isready -U screenai -d screen_ai` | **accepting connections** |
| Redis | `redis-cli ping` | **PONG** |

Containers were left running as-is (no recreate).

---

## What was added

| Artifact | Purpose |
|----------|---------|
| `docker-compose.yml` | Full stack orchestration |
| `backend/Dockerfile` | API image (CPU Torch + `requirements.docker.txt`) |
| `backend/requirements.docker.txt` | Deps without duplicate Torch pin |
| `frontend/Dockerfile` | Multi-stage Vite build → nginx |
| `frontend/nginx.conf` | SPA + API/SSE/health proxy |
| `.env.docker.example` | Production env template |
| `backend/services/health_service.py` | Dependency checks |
| `GET /health`, `/ready`, `/health/detailed` | Liveness / readiness |
| Startup `lifespan` checks | DB, storage, Firebase, Whisper (+ Redis ping) |

Frontend same-origin API: empty `VITE_API_BASE_URL` for nginx proxy (not a UI redesign).

---

## Startup checks (API boot)

```
[startup] dependency checks: OK
[startup]  - database: ok
[startup]  - storage: ok
[startup]  - firebase: ok
[startup]  - redis: ok
[startup]  - whisper: ok
```

Compose defaults: `WHISPER_MODEL=tiny`, `WHISPER_DEVICE=cpu` for faster first boot. Production can use `large-v3` / CUDA per `DEPLOYMENT.md`.

---

## Notes

- **OneDrive:** Docker build context can fail on cloud reparse files; build from a local path if needed.
- **Redis:** Included and reachable; not used as a job queue yet.
- **Secrets:** Set real Firebase / Postgres / ElevenLabs values in `.env.docker` before production.

---

## Redeploy

```bash
cp .env.docker.example .env.docker
# edit secrets + PUBLIC_BASE_URL / CORS_ORIGINS
docker compose --env-file .env.docker up --build -d
curl -fsS http://localhost/healthz
curl -fsS http://localhost/ready
```

Stop: `docker compose --env-file .env.docker down`  
Wipe volumes: add `-v`.
