import httpx

from app.services.onelink_error_mapper import (
    UNKNOWN_ONELINK_ERROR_MESSAGE,
    describe_onelink_http_error,
    describe_onelink_response_error,
    describe_onelink_timeout_error,
)


def test_describe_onelink_http_error_maps_insufficient_balance():
    request = httpx.Request("POST", "https://api.onelinkai.cloud/v1/chat/completions")
    response = httpx.Response(
        402,
        request=request,
        json={
            "error": {
                "message": "Insufficient balance for this request",
                "code": "insufficient_balance",
            },
            "request_id": "req-balance-1",
        },
    )
    exc = httpx.HTTPStatusError("payment required", request=request, response=response)

    message = describe_onelink_http_error(exc, model="gpt-4o", route="chat/completions")

    assert "余额或额度不足" in message
    assert "req-balance-1" in message


def test_describe_onelink_response_error_maps_invalid_key():
    message = describe_onelink_response_error(
        response_text='{"error":{"message":"Invalid API key provided","code":"invalid_api_key"}}',
        status_code=401,
        route="models",
    )

    assert "API Key 无效" in message


def test_describe_onelink_timeout_error_returns_chinese_message():
    request = httpx.Request("GET", "https://api.onelinkai.cloud/v1/models")
    exc = httpx.ReadTimeout("timed out", request=request)

    message = describe_onelink_timeout_error(exc, route="models")

    assert message == "OneLinkAI 响应超时，请稍后重试"


def test_describe_onelink_response_error_falls_back_to_unknown_message():
    message = describe_onelink_response_error(
        response_text='{"foo":"bar"}',
        status_code=418,
        route="models",
    )

    assert message == UNKNOWN_ONELINK_ERROR_MESSAGE


def test_describe_onelink_http_error_maps_model_unavailable():
    request = httpx.Request("POST", "https://api.onelinkai.cloud/v1/video/generations")
    response = httpx.Response(
        400,
        request=request,
        json={
            "error": {
                "message": "Model does not exist: veo-3.1-generate-preview",
                "code": "model_not_found",
            }
        },
    )
    exc = httpx.HTTPStatusError("bad request", request=request, response=response)

    message = describe_onelink_http_error(
        exc,
        model="veo-3.1-generate-preview",
        route="video/generations",
    )

    assert "veo-3.1-generate-preview" in message
    assert "当前不可用" in message


def test_describe_onelink_response_error_maps_content_policy():
    message = describe_onelink_response_error(
        response_text='{"error":{"message":"Request blocked by content policy","code":"content_policy_violation"}}',
        status_code=400,
        route="video/generations",
    )

    assert "内容安全或隐私风控" in message
