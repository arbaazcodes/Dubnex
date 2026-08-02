"""
ASGI middleware: request IDs + HTTP metrics + JSON access logs.
"""

from __future__ import annotations

import time
import uuid

from starlette.types import ASGIApp, Receive, Scope, Send

from services.logging_service import (
    get_logger,
    reset_request_id,
    set_request_id,
)
from services.metrics_service import observe_error, observe_http

logger = get_logger("screen_ai.http")

REQUEST_ID_HEADER = b"x-request-id"


class ObservabilityMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = list(scope.get("headers") or [])
        incoming = None
        for name, value in headers:
            if name.lower() == REQUEST_ID_HEADER:
                incoming = value.decode("latin-1").strip()
                break
        request_id = incoming or uuid.uuid4().hex
        token = set_request_id(request_id)

        # Ensure downstream sees the id
        if not incoming:
            headers.append((REQUEST_ID_HEADER, request_id.encode("latin-1")))
            scope = dict(scope)
            scope["headers"] = headers

        method = scope.get("method", "GET")
        path = scope.get("path") or "/"
        started = time.perf_counter()
        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message.get("status", 500))
                raw_headers = list(message.get("headers") or [])
                raw_headers.append((REQUEST_ID_HEADER, request_id.encode("latin-1")))
                message = {**message, "headers": raw_headers}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            observe_error("http_unhandled")
            logger.exception(
                "Unhandled request error",
                extra={"event": "http_error", "method": method, "path": path},
            )
            raise
        finally:
            duration = time.perf_counter() - started
            # Skip metrics scrape noise reduction? Still count /metrics.
            observe_http(method, path, status_code, duration)
            logger.info(
                "request completed",
                extra={
                    "event": "http_request",
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": round(duration * 1000, 2),
                },
            )
            reset_request_id(token)
