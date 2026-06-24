from __future__ import annotations

from starlette.concurrency import run_in_threadpool

from app.config import settings


class TencentSmsError(Exception):
    """Base error for Tencent SMS delivery."""


class TencentSmsConfigError(TencentSmsError):
    """Raised when Tencent SMS config is incomplete."""


class TencentSmsDeliveryError(TencentSmsError):
    """Raised when Tencent SMS delivery fails."""


def _ensure_sms_config() -> None:
    required_settings = {
        "TENCENT_SMS_SECRET_ID": settings.TENCENT_SMS_SECRET_ID,
        "TENCENT_SMS_SECRET_KEY": settings.TENCENT_SMS_SECRET_KEY,
        "TENCENT_SMS_SDK_APP_ID": settings.TENCENT_SMS_SDK_APP_ID,
        "TENCENT_SMS_SIGN_NAME": settings.TENCENT_SMS_SIGN_NAME,
        "TENCENT_SMS_LOGIN_TEMPLATE_ID": settings.TENCENT_SMS_LOGIN_TEMPLATE_ID,
        "TENCENT_SMS_REGION": settings.TENCENT_SMS_REGION,
    }
    missing_fields = [key for key, value in required_settings.items() if not str(value).strip()]
    if missing_fields:
        raise TencentSmsConfigError(
            "腾讯云短信配置不完整，请检查：%s" % ", ".join(missing_fields)
        )


def _normalize_phone_number(phone: str) -> str:
    normalized = phone.strip()
    if normalized.startswith("+"):
        return normalized
    if normalized.startswith("0086"):
        return f"+{normalized[2:]}"
    if normalized.startswith("86") and len(normalized) == 13:
        return f"+{normalized}"
    if len(normalized) == 11 and normalized.isdigit():
        return f"+86{normalized}"
    return normalized


def _get_code_expire_minutes() -> str:
    expire_minutes = max(1, (int(settings.AUTH_CODE_EXPIRE_SECONDS) + 59) // 60)
    return str(expire_minutes)


def _send_sms_request(phone: str, code: str) -> None:
    try:
        from tencentcloud.common import credential
        from tencentcloud.common.exception.tencent_cloud_sdk_exception import (
            TencentCloudSDKException,
        )
        from tencentcloud.common.profile.client_profile import ClientProfile
        from tencentcloud.common.profile.http_profile import HttpProfile
        from tencentcloud.sms.v20210111 import models, sms_client
    except ImportError as exc:
        raise TencentSmsConfigError(
            "腾讯云短信 SDK 未安装，请先执行 pip install -r requirements.txt"
        ) from exc

    _ensure_sms_config()

    try:
        cred = credential.Credential(
            settings.TENCENT_SMS_SECRET_ID,
            settings.TENCENT_SMS_SECRET_KEY,
        )
        http_profile = HttpProfile()
        client_profile = ClientProfile()
        client_profile.httpProfile = http_profile
        client = sms_client.SmsClient(cred, settings.TENCENT_SMS_REGION, client_profile)

        request = models.SendSmsRequest()
        request.PhoneNumberSet = [_normalize_phone_number(phone)]
        request.SmsSdkAppId = settings.TENCENT_SMS_SDK_APP_ID
        request.SignName = settings.TENCENT_SMS_SIGN_NAME
        request.TemplateId = settings.TENCENT_SMS_LOGIN_TEMPLATE_ID
        request.TemplateParamSet = [code, _get_code_expire_minutes()]
        request.SessionContext = phone

        response = client.SendSms(request)
    except TencentCloudSDKException as exc:
        raise TencentSmsDeliveryError(f"腾讯云短信发送失败：{exc}") from exc

    send_statuses = getattr(response, "SendStatusSet", None) or []
    first_status = send_statuses[0] if send_statuses else None
    status_code = getattr(first_status, "Code", "")
    if status_code != "Ok":
        status_message = getattr(first_status, "Message", "") or "未知错误"
        raise TencentSmsDeliveryError(f"腾讯云短信发送失败：{status_message}")


async def send_login_verification_code(phone: str, code: str) -> None:
    await run_in_threadpool(_send_sms_request, phone, code)
