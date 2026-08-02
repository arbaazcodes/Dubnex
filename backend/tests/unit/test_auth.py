"""Unit tests for Firebase auth helpers."""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request


def _request(headers=None, query=None):
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "query_string": "&".join(f"{k}={v}" for k, v in (query or {}).items()).encode(),
    }
    return Request(scope)


def test_extract_bearer_token():
    from services.firebase_auth import extract_id_token

    req = _request(headers={"Authorization": "Bearer abc.token"})
    assert extract_id_token(req) == "abc.token"


def test_extract_query_token():
    from services.firebase_auth import extract_id_token

    req = _request(query={"token": "query-token"})
    assert extract_id_token(req) == "query-token"


def test_missing_token_unauthorized():
    from services.firebase_auth import require_authenticated_user

    with pytest.raises(HTTPException) as ei:
        require_authenticated_user(_request())
    assert ei.value.status_code == 401


def test_verify_invalid_token(monkeypatch):
    from services import firebase_auth as fa

    mock_id = MagicMock()
    mock_id.verify_firebase_token = MagicMock(side_effect=ValueError("bad"))
    monkeypatch.setattr(fa, "id_token", mock_id)
    monkeypatch.setattr(fa, "google_requests", MagicMock())
    with pytest.raises(HTTPException) as ei:
        fa.verify_firebase_id_token("not-a-real-token")
    assert ei.value.status_code == 401


def test_verify_valid_token(monkeypatch):
    from services import firebase_auth as fa

    mock_id = MagicMock()
    mock_id.verify_firebase_token = MagicMock(
        return_value={
            "uid": "uid-99",
            "email": "a@b.c",
            "name": "A",
        }
    )
    monkeypatch.setattr(fa, "id_token", mock_id)
    monkeypatch.setattr(fa, "google_requests", MagicMock())
    user = fa.verify_firebase_id_token("good")
    assert user.uid == "uid-99"
    assert user.email == "a@b.c"
