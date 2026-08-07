"""
ASGI middleware applying baseline security response headers.

Headers are only added when absent (setdefault semantics) so route/file
handlers may override with stricter values. Implemented as a raw ASGI
middleware (not BaseHTTPMiddleware) so it works reliably with streaming
responses (FileResponse / SSE) without buffering.

This protects API responses served directly by FastAPI. The static SPA
(frontend) is served by the CDN/hosting layer via frontend/public/_headers.
"""

from __future__ import annotations

from starlette.types import ASGIApp, Receive, Scope, Send

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(self), payment=(), usb=()",
    "X-DNS-Prefetch-Control": "off",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: dict) -> None:
            if message["type"] == "http.response.start":
                raw_headers = list(message.get("headers") or [])
                existing = {name.lower() for name, _ in raw_headers}
                for name, value in SECURITY_HEADERS.items():
                    if name.lower() not in existing:
                        raw_headers.append((name.encode("latin-1"), value.encode("latin-1")))
                message = {**message, "headers": raw_headers}
            await send(message)

        await self.app(scope, receive, send_wrapper)
