"""
Prometheus metrics for SCREEN.AI (Grafana-ready).

Observes HTTP traffic, pipeline stage timings, job outcomes, errors, and health.
Does not alter AI pipeline behavior.
"""

from __future__ import annotations

import re
import time
from typing import Any

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# Dedicated registry so tests / multiple imports stay clean
REGISTRY = CollectorRegistry()

# --- HTTP ---
HTTP_REQUESTS = Counter(
    "screen_ai_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
    registry=REGISTRY,
)
HTTP_DURATION = Histogram(
    "screen_ai_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120),
    registry=REGISTRY,
)

# --- Pipeline stages (Grafana-friendly stage labels) ---
STAGE_DURATION = Histogram(
    "screen_ai_pipeline_stage_duration_seconds",
    "Duration of each pipeline stage",
    ["stage"],
    buckets=(0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1200, 3600),
    registry=REGISTRY,
)
STAGE_STARTED = Counter(
    "screen_ai_pipeline_stage_started_total",
    "Pipeline stage start events",
    ["stage"],
    registry=REGISTRY,
)

# --- Jobs ---
JOBS_TOTAL = Counter(
    "screen_ai_jobs_total",
    "Jobs by terminal status",
    ["status"],
    registry=REGISTRY,
)
JOB_DURATION = Histogram(
    "screen_ai_job_duration_seconds",
    "End-to-end job wall-clock duration",
    ["status"],
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1200, 3600, 7200),
    registry=REGISTRY,
)
JOBS_IN_PROGRESS = Gauge(
    "screen_ai_jobs_in_progress",
    "Jobs currently processing",
    registry=REGISTRY,
)

# --- Queue / worker throughput ---
QUEUE_WAIT = Histogram(
    "screen_ai_queue_wait_seconds",
    "Time from enqueue to worker start",
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300),
    registry=REGISTRY,
)
WORKER_JOB_DURATION = Histogram(
    "screen_ai_worker_job_duration_seconds",
    "Worker process_video wall time (excludes queue wait)",
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1200, 3600),
    registry=REGISTRY,
)
WORKER_JOBS_COMPLETED = Counter(
    "screen_ai_worker_jobs_completed_total",
    "Jobs fully processed by workers",
    ["status"],
    registry=REGISTRY,
)
WORKER_THROUGHPUT = Gauge(
    "screen_ai_worker_throughput_jobs_per_minute",
    "Rolling estimate of worker throughput (jobs/min)",
    registry=REGISTRY,
)

# --- Errors ---
ERRORS_TOTAL = Counter(
    "screen_ai_errors_total",
    "Application errors by type",
    ["error_type"],
    registry=REGISTRY,
)

# --- Health ---
HEALTH_UP = Gauge(
    "screen_ai_health_up",
    "Component health (1=up, 0=down)",
    ["component"],
    registry=REGISTRY,
)
HEALTH_CHECK_LATENCY = Gauge(
    "screen_ai_health_check_latency_seconds",
    "Last health-check latency per component",
    ["component"],
    registry=REGISTRY,
)

# Map internal stage names → stable metric labels
STAGE_LABEL_MAP = {
    "Upload": "upload",
    "Audio Extraction": "ffmpeg",
    "Whisper": "whisper",
    "Translation": "translation",
    "TTS": "tts",
    "Audio Merge": "merge",
    "Video Rendering": "render",
    "Completed": "completed",
    "Failed": "failed",
}

_UUID_RE = re.compile(
    r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
)
_HEX_RE = re.compile(r"/[0-9a-fA-F]{16,}(?=/|$)")


def normalize_path(path: str) -> str:
    """Reduce cardinality for Prometheus path labels."""
    if not path:
        return "/"
    p = path.split("?", 1)[0]
    p = _UUID_RE.sub("{id}", p)
    p = _HEX_RE.sub("/{id}", p)
    # Cap length
    if len(p) > 80:
        p = p[:80]
    return p or "/"


def stage_label(stage: str | None) -> str:
    if not stage:
        return "unknown"
    return STAGE_LABEL_MAP.get(stage, stage.lower().replace(" ", "_"))


def observe_http(method: str, path: str, status: int, duration_sec: float) -> None:
    p = normalize_path(path)
    m = (method or "GET").upper()
    HTTP_REQUESTS.labels(method=m, path=p, status=str(status)).inc()
    HTTP_DURATION.labels(method=m, path=p).observe(max(0.0, duration_sec))


def observe_stage_start(stage: str) -> None:
    STAGE_STARTED.labels(stage=stage_label(stage)).inc()


def observe_stage_duration(stage: str, duration_sec: float) -> None:
    if duration_sec < 0:
        return
    STAGE_DURATION.labels(stage=stage_label(stage)).observe(duration_sec)


def observe_job_started() -> None:
    JOBS_IN_PROGRESS.inc()


def observe_job_finished(status: str, duration_sec: float | None) -> None:
    st = (status or "unknown").lower()
    JOBS_TOTAL.labels(status=st).inc()
    if duration_sec is not None and duration_sec >= 0:
        JOB_DURATION.labels(status=st).observe(duration_sec)
    try:
        JOBS_IN_PROGRESS.dec()
    except Exception:
        pass


def observe_error(error_type: str) -> None:
    ERRORS_TOTAL.labels(error_type=(error_type or "unknown")[:64]).inc()


_throughput_window: list[float] = []


def observe_queue_wait(wait_sec: float) -> None:
    if wait_sec is None or wait_sec < 0:
        return
    QUEUE_WAIT.observe(wait_sec)


def observe_worker_job(status: str, duration_sec: float | None) -> None:
    st = (status or "unknown").lower()
    WORKER_JOBS_COMPLETED.labels(status=st).inc()
    if duration_sec is not None and duration_sec >= 0:
        WORKER_JOB_DURATION.observe(duration_sec)
        now = time.time()
        _throughput_window.append(now)
        # Keep ~5 minutes of completions
        cutoff = now - 300
        while _throughput_window and _throughput_window[0] < cutoff:
            _throughput_window.pop(0)
        span = max(now - _throughput_window[0], 1.0) if _throughput_window else 1.0
        rate = len(_throughput_window) / span * 60.0
        WORKER_THROUGHPUT.set(round(rate, 3))


def refresh_health_metrics() -> dict[str, Any]:
    """Run lightweight checks and update health gauges (for /metrics scrapes)."""
    from services.health_service import run_checks

    # Skip whisper on every scrape to keep /metrics cheap; use last known / startup.
    result = run_checks(include_whisper=False)
    checks = result.get("checks") or {}
    for name, detail in checks.items():
        HEALTH_UP.labels(component=name).set(1 if detail.get("ok") else 0)
        latency_ms = detail.get("latency_ms")
        if latency_ms is not None:
            HEALTH_CHECK_LATENCY.labels(component=name).set(float(latency_ms) / 1000.0)
    # Whisper: mark up if model singleton is loaded
    try:
        from services import whisper_service

        loaded = getattr(whisper_service, "model", None) is not None
        HEALTH_UP.labels(component="whisper").set(1 if loaded else 0)
    except Exception:
        HEALTH_UP.labels(component="whisper").set(0)
    return result


def metrics_payload() -> tuple[bytes, str]:
    refresh_health_metrics()
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST


def parse_iso_to_epoch(iso: str | None) -> float | None:
    if not iso:
        return None
    try:
        # Support naive ISO from job_service
        from datetime import datetime

        text = iso.replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
        return dt.timestamp()
    except Exception:
        return None


def duration_between(start_iso: str | None, end_iso: str | None) -> float | None:
    a = parse_iso_to_epoch(start_iso)
    b = parse_iso_to_epoch(end_iso)
    if a is None or b is None:
        return None
    return max(0.0, b - a)
