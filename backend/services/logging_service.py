"""
Structured JSON logging with request-id context.

Does not change business logic — logging only.
"""

from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)
job_id_ctx: ContextVar[str | None] = ContextVar("job_id", default=None)


def get_request_id() -> str | None:
    return request_id_ctx.get()


def set_request_id(value: str | None):
    return request_id_ctx.set(value)


def reset_request_id(token) -> None:
    request_id_ctx.reset(token)


def get_job_id() -> str | None:
    return job_id_ctx.get()


def set_job_id(value: str | None):
    return job_id_ctx.set(value)


def reset_job_id(token) -> None:
    job_id_ctx.reset(token)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        rid = get_request_id()
        if rid:
            payload["request_id"] = rid
        jid = get_job_id()
        if jid:
            payload["job_id"] = jid
        if getattr(record, "job_id", None):
            payload["job_id"] = record.job_id
        if getattr(record, "stage", None):
            payload["stage"] = record.stage
        if getattr(record, "duration_ms", None) is not None:
            payload["duration_ms"] = record.duration_ms
        if getattr(record, "path", None):
            payload["path"] = record.path
        if getattr(record, "method", None):
            payload["method"] = record.method
        if getattr(record, "status_code", None) is not None:
            payload["status_code"] = record.status_code
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        # Extra fields passed via logger.bind-style extra=
        for key in ("event", "error_type", "component"):
            val = getattr(record, key, None)
            if val is not None:
                payload[key] = val
        return json.dumps(payload, ensure_ascii=False)


_configured = False


def configure_logging(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # Quiet noisy libs
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    _configured = True


def get_logger(name: str = "screen_ai") -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
