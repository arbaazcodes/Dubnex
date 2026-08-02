"""
Firebase ID token verification for SCREEN.AI API auth.
Uses Google's public certs via google-auth (no service account required for verify).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, Request

from config import FIREBASE_PROJECT_ID

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:  # pragma: no cover
    id_token = None
    google_requests = None


@dataclass
class AuthenticatedUser:
    uid: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None
    claims: dict[str, Any] | None = None


def extract_id_token(request: Request) -> str | None:
    """
    Prefer Authorization: Bearer <Firebase ID token>.
    Fall back to ?token= for media elements / EventSource (cannot set headers).
    Does NOT accept X-User-Id (spoofable).
    """
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization") or ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            return token

    query_token = request.query_params.get("token")
    if query_token and query_token.strip():
        return query_token.strip()

    return None


def verify_firebase_id_token(token: str) -> AuthenticatedUser:
    if not FIREBASE_PROJECT_ID:
        raise HTTPException(
            status_code=500,
            detail="Server authentication is not configured (FIREBASE_PROJECT_ID missing).",
        )
    if id_token is None or google_requests is None:
        raise HTTPException(
            status_code=500,
            detail="Server authentication dependency missing (google-auth).",
        )
    if not token or not isinstance(token, str):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        decoded = id_token.verify_firebase_token(
            token,
            google_requests.Request(),
            audience=FIREBASE_PROJECT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized: invalid or expired token")

    uid = decoded.get("uid") or decoded.get("user_id") or decoded.get("sub")
    if not uid:
        raise HTTPException(status_code=401, detail="Unauthorized: token missing uid")

    return AuthenticatedUser(
        uid=str(uid),
        email=decoded.get("email"),
        name=decoded.get("name"),
        picture=decoded.get("picture"),
        claims=dict(decoded),
    )


def require_authenticated_user(request: Request) -> AuthenticatedUser:
    token = extract_id_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: missing bearer token")
    return verify_firebase_id_token(token)
