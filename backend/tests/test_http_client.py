import logging

import httpx

from app.services.http_client import (
    build_upstream_limits,
    classify_upstream_error,
    log_upstream_failure,
)


def test_build_upstream_limits_uses_positive_values():
    limits = build_upstream_limits()
    assert limits.max_connections > 0
    assert limits.max_keepalive_connections > 0
    assert limits.keepalive_expiry > 0


def test_classify_upstream_error_marks_retryable_http_status():
    request = httpx.Request("GET", "https://example.com")
    response = httpx.Response(status_code=503, request=request)
    error = httpx.HTTPStatusError("boom", request=request, response=response)

    detail = classify_upstream_error(error)

    assert detail["category"] == "retryable_http_status"
    assert detail["retryable"] is True
    assert detail["status_code"] == 503


def test_classify_upstream_error_marks_timeout():
    request = httpx.Request("GET", "https://example.com")
    error = httpx.ReadTimeout("timeout", request=request)

    detail = classify_upstream_error(error)

    assert detail["category"] == "timeout"
    assert detail["retryable"] is True
    assert detail["status_code"] is None


def test_log_upstream_failure_uses_warning_for_retryable_error(caplog):
    request = httpx.Request("GET", "https://example.com")
    response = httpx.Response(status_code=429, request=request)
    error = httpx.HTTPStatusError("rate limited", request=request, response=response)

    with caplog.at_level(logging.WARNING, logger="app.upstream"):
        detail = log_upstream_failure(
            profile="provider",
            operation="provider_connection_test",
            exc=error,
            context={"provider_type": "minimax"},
        )

    assert detail["category"] == "retryable_http_status"
    assert "profile=provider" in caplog.text
    assert "operation=provider_connection_test" in caplog.text
    assert "provider_type=minimax" in caplog.text


def test_log_upstream_failure_uses_error_for_unexpected_error(caplog):
    with caplog.at_level(logging.ERROR, logger="app.upstream"):
        detail = log_upstream_failure(
            profile="model",
            operation="llm_chat_completion",
            exc=RuntimeError("boom"),
        )

    assert detail["category"] == "unexpected"
    assert detail["retryable"] is False
    assert "profile=model" in caplog.text
    assert "category=unexpected" in caplog.text
