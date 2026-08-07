"""Unit tests for the process-local rate limiter (services/rate_limit.py)."""

from __future__ import annotations

import time

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import config as app_config
from services.firebase_auth import AuthenticatedUser
from services.rate_limit import (
    RateLimiter,
    enforce_rate_limit,
    get_limiter,
    reset_rate_limiter,
)


def _make_request(host: str = "203.0.113.5") -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/chat",
        "raw_path": b"/api/chat",
        "query_string": b"",
        "headers": [],
        "client": (host, 1234),
        "server": ("testserver", 80),
        "app": {},
    }
    return Request(scope)


class TestRateLimiter:
    def test_allows_requests_within_budget(self):
        limiter = RateLimiter()
        for _ in range(5):
            allowed, _ = limiter.hit("u:1", limit=5, window_seconds=60)
            assert allowed is True

    def test_rejects_over_budget_with_retry_after(self):
        limiter = RateLimiter()
        for _ in range(2):
            allowed, _ = limiter.hit("u:1", limit=2, window_seconds=60)
            assert allowed is True
        allowed, retry_after = limiter.hit("u:1", limit=2, window_seconds=60)
        assert allowed is False
        assert retry_after >= 1

    def test_keys_are_independent(self):
        limiter = RateLimiter()
        for _ in range(3):
            limiter.hit("u:a", limit=3, window_seconds=60)
        allowed, _ = limiter.hit("u:b", limit=3, window_seconds=60)
        assert allowed is True

    def test_window_rolls_over(self):
        limiter = RateLimiter()
        for _ in range(2):
            limiter.hit("u:1", limit=2, window_seconds=0.05)
        allowed, _ = limiter.hit("u:1", limit=2, window_seconds=0.05)
        assert allowed is False
        time.sleep(0.06)
        allowed, _ = limiter.hit("u:1", limit=2, window_seconds=0.05)
        assert allowed is True

    def test_reset_clears_counters(self):
        limiter = RateLimiter()
        for _ in range(3):
            limiter.hit("u:1", limit=2, window_seconds=60)
        limiter.reset()
        allowed, _ = limiter.hit("u:1", limit=2, window_seconds=60)
        assert allowed is True


class TestEnforceRateLimit:
    def test_user_budget_exhausted_raises_429(self, monkeypatch):
        monkeypatch.setattr(app_config, "RATE_LIMIT_ENABLED", True)
        monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_USER", 2)
        monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_IP", 100)
        monkeypatch.setattr(app_config, "RATE_LIMIT_WINDOW_SECONDS", 60)
        reset_rate_limiter()

        user = AuthenticatedUser(uid="user-x", email="x@example.com", name="X")
        req = _make_request()
        enforce_rate_limit(req, user)
        enforce_rate_limit(req, user)
        with pytest.raises(HTTPException) as excinfo:
            enforce_rate_limit(req, user)
        assert excinfo.value.status_code == 429
        assert "Retry-After" in excinfo.value.headers

    def test_ip_budget_independent_of_user(self, monkeypatch):
        monkeypatch.setattr(app_config, "RATE_LIMIT_ENABLED", True)
        monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_USER", 100)
        monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_IP", 1)
        monkeypatch.setattr(app_config, "RATE_LIMIT_WINDOW_SECONDS", 60)
        reset_rate_limiter()

        user_a = AuthenticatedUser(uid="a", email="a@example.com", name="A")
        user_b = AuthenticatedUser(uid="b", email="b@example.com", name="B")
        req = _make_request()
        # Different users, same IP: the IP budget trips after one request.
        enforce_rate_limit(req, user_a)
        with pytest.raises(HTTPException) as excinfo:
            enforce_rate_limit(req, user_b)
        assert excinfo.value.status_code == 429

    def test_disabled_is_noop(self, monkeypatch):
        monkeypatch.setattr(app_config, "RATE_LIMIT_ENABLED", False)
        reset_rate_limiter()

        # Even a fresh unknown client (no user) passes when disabled.
        enforce_rate_limit(_make_request(), None)
        enforce_rate_limit(_make_request(), None)
        assert True  # no exception raised

    def test_anonymous_uses_ip_budget(self, monkeypatch):
        monkeypatch.setattr(app_config, "RATE_LIMIT_ENABLED", True)
        monkeypatch.setattr(app_config, "RATE_LIMIT_MAX_PER_IP", 2)
        monkeypatch.setattr(app_config, "RATE_LIMIT_WINDOW_SECONDS", 60)
        reset_rate_limiter()

        req = _make_request()
        enforce_rate_limit(req, None)
        enforce_rate_limit(req, None)
        with pytest.raises(HTTPException):
            enforce_rate_limit(req, None)


def test_get_limiter_is_singleton():
    assert get_limiter() is get_limiter()
