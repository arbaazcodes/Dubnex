# OBSERVABILITY_REPORT.md

**Sprint:** 13 — Observability  
**Date:** 2026-08-02  
**Scope:** Production monitoring (JSON logs, request IDs, stage/job/error/health metrics, Prometheus). AI pipeline and UI unchanged.

---

## Summary

SCREEN.AI now emits **structured JSON logs**, stamps every HTTP request with an **`X-Request-ID`**, records **per-stage pipeline timings**, and exposes a Grafana-ready **`GET /metrics`** Prometheus endpoint.

Business logic and the AI pipeline (`pipeline_service`) were **not** modified — observations hook into existing `create_job` / `update_job` / `finish_job` / `fail_job` and HTTP middleware.

---

## Components

| Piece | Location |
|-------|----------|
| JSON logging + request/job context | `backend/services/logging_service.py` |
| Prometheus metrics | `backend/services/metrics_service.py` |
| Request ID + HTTP metrics middleware | `backend/services/observability_middleware.py` |
| Stage/job metric hooks | `backend/services/job_service.py` |
| `/metrics` route | `backend/app.py` |
| nginx proxy for `/metrics` | `frontend/nginx.conf` |
| Dependency | `prometheus_client` |

---

## 1. Structured JSON logging

Stdout logs are single-line JSON:

```json
{
  "ts": "2026-08-02T05:01:35.075990+00:00",
  "level": "INFO",
  "logger": "screen_ai.jobs",
  "message": "pipeline stage completed",
  "request_id": "…",
  "job_id": "…",
  "stage": "Upload",
  "duration_ms": 422.42,
  "event": "stage_completed"
}
```

Events include: `http_request`, `job_created`, `stage_completed`, `job_completed`, `job_failed`.

---

## 2. Request IDs

- Incoming `X-Request-ID` is honored; otherwise a new UUID is generated.
- Echoed on every response as `X-Request-ID`.
- Included in JSON logs via contextvars.
- CORS exposes `X-Request-ID`.

---

## 3. Per-stage timing

When a job advances stages, the previous stage’s wall time is recorded (and exported to Prometheus).

| Pipeline stage (internal) | Metric label |
|---------------------------|--------------|
| Upload | `upload` |
| Audio Extraction (FFmpeg) | `ffmpeg` |
| Whisper | `whisper` |
| Translation | `translation` |
| TTS | `tts` |
| Audio Merge | `merge` |
| Video Rendering | `render` |

Also stored on the job as `stage_durations_sec` (observability metadata only).

---

## 4–6. Job, error, and health metrics

| Metric | Type | Purpose |
|--------|------|---------|
| `screen_ai_jobs_total{status}` | Counter | `completed` / `failed` |
| `screen_ai_job_duration_seconds{status}` | Histogram | End-to-end job duration |
| `screen_ai_jobs_in_progress` | Gauge | Active jobs |
| `screen_ai_errors_total{error_type}` | Counter | e.g. `job_failed`, `http_unhandled` |
| `screen_ai_health_up{component}` | Gauge | `database`, `storage`, `firebase`, `redis`, `whisper` |
| `screen_ai_health_check_latency_seconds{component}` | Gauge | Last check latency |

Health gauges refresh on each `/metrics` scrape (Whisper uses in-process model presence to keep scrapes light).

---

## 7–8. Prometheus / Grafana

**Endpoint:** `GET /metrics` (also proxied via frontend nginx).

Additional HTTP series:

- `screen_ai_http_requests_total{method,path,status}`
- `screen_ai_http_request_duration_seconds{method,path}`
- `screen_ai_pipeline_stage_duration_seconds{stage}`
- `screen_ai_pipeline_stage_started_total{stage}`

Paths are normalized (`{id}` for UUIDs) to limit cardinality.

### Example Prometheus scrape

```yaml
scrape_configs:
  - job_name: screen-ai
    metrics_path: /metrics
    static_configs:
      - targets: ["api:8000"]  # or host:8000 / via nginx
```

### Example Grafana panels

1. **Job success rate** — `rate(screen_ai_jobs_total{status="completed"}[5m]) / rate(screen_ai_jobs_total[5m])`
2. **p95 job duration** — `histogram_quantile(0.95, sum(rate(screen_ai_job_duration_seconds_bucket[5m])) by (le, status))`
3. **Stage latency** — `histogram_quantile(0.95, sum(rate(screen_ai_pipeline_stage_duration_seconds_bucket[5m])) by (le, stage))`
4. **Error rate** — `sum(rate(screen_ai_errors_total[5m])) by (error_type)`
5. **Health** — `screen_ai_health_up`
6. **HTTP p95** — `histogram_quantile(0.95, sum(rate(screen_ai_http_request_duration_seconds_bucket[5m])) by (le, path))`

---

## Verification

Smoke test (local, no pipeline run):

- JSON logs with `request_id` / `job_id` / `stage` / `duration_ms`
- Stage durations for Upload → FFmpeg → Whisper → Translation → TTS → Merge → Render
- `/metrics` payload contains job, stage, error, and health series
- Failed job increments `screen_ai_errors_total` and `jobs_total{status="failed"}`

Result: **OBS_SMOKE_OK**

---

## What was not changed

- AI pipeline steps / models / prompts
- Frontend UI
- Storage / auth / DB schemas (aside from optional in-memory `stage_durations_sec` on jobs)
