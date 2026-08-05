"""
Health and startup dependency checks for production readiness.

Checks (non-destructive; does not alter the AI pipeline):
  - database
  - object storage
  - Firebase auth config
  - Whisper model load/config
  - Redis (optional; prepared for future queue)
"""

from __future__ import annotations

import os
import time
from typing import Any

from config import (
    DATABASE_PROVIDER,
    DATABASE_URL,
    FIREBASE_PROJECT_ID,
    WHISPER_MODEL,
    DEVICE as WHISPER_DEVICE,
    COMPUTE_TYPE as WHISPER_COMPUTE_TYPE,
    STORAGE_PROVIDER,
    OUTPUT_DIR,
    S3_BUCKET,
    REDIS_URL,
    STRICT_STARTUP,
    GEMINI_API_KEY,
)


def _check_database() -> dict[str, Any]:
    started = time.perf_counter()
    try:
        from services.db import get_engine, init_db
        from sqlalchemy import text

        init_db()
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "ok": True,
            "provider": DATABASE_PROVIDER,
            "url_scheme": (DATABASE_URL or "").split("://", 1)[0] if DATABASE_URL else None,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except Exception as exc:
        return {
            "ok": False,
            "provider": DATABASE_PROVIDER,
            "error": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }


def _check_storage() -> dict[str, Any]:
    started = time.perf_counter()
    try:
        from services.storage_service import get_storage

        storage = get_storage()
        detail: dict[str, Any] = {
            "ok": True,
            "provider": storage.name,
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
        if storage.name == "local":
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            probe = os.path.join(OUTPUT_DIR, ".healthwrite")
            with open(probe, "w", encoding="utf-8") as f:
                f.write("ok")
            os.remove(probe)
            detail["output_dir"] = OUTPUT_DIR
            detail["writable"] = True
        elif storage.name == "s3":
            if not S3_BUCKET:
                return {
                    "ok": False,
                    "provider": "s3",
                    "error": "S3_BUCKET is not set",
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            # Lightweight existence probe via client (head bucket)
            try:
                storage.client.head_bucket(Bucket=storage.bucket)
                detail["bucket"] = storage.bucket
            except Exception as bucket_exc:
                # Bucket policy may deny head; still report configured
                detail["bucket"] = storage.bucket
                detail["bucket_warning"] = str(bucket_exc)
        return detail
    except Exception as exc:
        return {
            "ok": False,
            "provider": STORAGE_PROVIDER,
            "error": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }


def _check_firebase() -> dict[str, Any]:
    started = time.perf_counter()
    project_id = (FIREBASE_PROJECT_ID or "").strip()
    if not project_id:
        return {
            "ok": False,
            "configured": False,
            "error": "FIREBASE_PROJECT_ID is not set",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    try:
        from google.oauth2 import id_token  # noqa: F401
        from google.auth.transport import requests as google_requests  # noqa: F401

        return {
            "ok": True,
            "configured": True,
            "project_id": project_id,
            "verifier": "google-auth",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except ImportError as exc:
        return {
            "ok": False,
            "configured": True,
            "project_id": project_id,
            "error": f"google-auth missing: {exc}",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }


def _check_whisper() -> dict[str, Any]:
    started = time.perf_counter()
    detail: dict[str, Any] = {
        "model": WHISPER_MODEL,
        "device": WHISPER_DEVICE,
        "compute_type": WHISPER_COMPUTE_TYPE,
    }
    try:
        # Pipeline loads Whisper at import time; confirm the singleton exists.
        from services import whisper_service

        model = getattr(whisper_service, "model", None)
        if model is None:
            detail.update(
                {
                    "ok": False,
                    "loaded": False,
                    "error": "Whisper model object is None",
                    "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                }
            )
            return detail
        detail.update(
            {
                "ok": True,
                "loaded": True,
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        )
        return detail
    except Exception as exc:
        detail.update(
            {
                "ok": False,
                "loaded": False,
                "error": str(exc),
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            }
        )
        return detail


def _check_redis() -> dict[str, Any]:
    started = time.perf_counter()
    url = (REDIS_URL or "").strip()
    if not url:
        return {
            "ok": True,
            "configured": False,
            "skipped": True,
            "message": "REDIS_URL not set (optional; reserved for future queue)",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    try:
        import redis

        client = redis.from_url(url, socket_connect_timeout=2, socket_timeout=2)
        pong = client.ping()
        return {
            "ok": bool(pong),
            "configured": True,
            "url_scheme": url.split("://", 1)[0],
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    except Exception as exc:
        return {
            "ok": False,
            "configured": True,
            "error": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }


def _check_gemini() -> dict[str, Any]:
    """Gemini is optional; missing key warns but does not fail readiness."""
    started = time.perf_counter()
    try:
        from services import gemini_service

        detail = gemini_service.health_detail()
        detail["latency_ms"] = round((time.perf_counter() - started) * 1000, 1)
        return detail
    except Exception as exc:
        return {
            "ok": True,
            "configured": bool(GEMINI_API_KEY),
            "warning": str(exc),
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
        }


def run_checks(*, include_whisper: bool = True) -> dict[str, Any]:
    checks = {
        "database": _check_database(),
        "storage": _check_storage(),
        "firebase": _check_firebase(),
        "redis": _check_redis(),
        "gemini": _check_gemini(),
    }
    if include_whisper:
        checks["whisper"] = _check_whisper()

    # Required for readiness: database + storage + firebase config.
    # Whisper is required when include_whisper=True (full app).
    # Redis and Gemini are optional.
    required = ["database", "storage", "firebase"]
    if include_whisper:
        required.append("whisper")

    ok = all(checks[name].get("ok") for name in required)
    return {
        "ok": ok,
        "strict": STRICT_STARTUP,
        "checks": checks,
        "required": required,
    }


def run_startup_checks() -> dict[str, Any]:
    """Run once at application startup; optionally abort when STRICT_STARTUP=true."""
    result = run_checks(include_whisper=True)
    status = "OK" if result["ok"] else "DEGRADED"
    print(f"[startup] dependency checks: {status}")
    for name, detail in result["checks"].items():
        flag = "ok" if detail.get("ok") else "FAIL"
        extra = detail.get("error") or detail.get("message") or detail.get("warning") or ""
        print(f"[startup]  - {name}: {flag} {extra}".rstrip())
        if name == "gemini" and not detail.get("configured"):
            print(
                "[startup]  - gemini: WARN GEMINI_API_KEY is not set "
                "(Gemini translation/chat disabled; NLLB fallback used when auto)"
            )

    if STRICT_STARTUP and not result["ok"]:
        failed = [n for n in result["required"] if not result["checks"][n].get("ok")]
        raise RuntimeError(f"Strict startup failed for: {', '.join(failed)}")

    return result
