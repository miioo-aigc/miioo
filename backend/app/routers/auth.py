import secrets
import json
import urllib.request
import uuid
from urllib.parse import urlencode, urlsplit, urlunsplit
from datetime import date, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.provider import ApiProvider
from app.schemas.auth import (
    LoginRequest,
    QrCodeConfirmRequest,
    WechatCallbackCompleteRequest,
    WechatCallbackCompleteResponse,
    QrCodePollResponse,
    QrCodeSessionResponse,
    RefreshRequest,
    RegisterRequest,
    SendCodeRequest,
    SendCodeResponse,
    TokenResponse,
    UserResponse,
    VerifyCodeLoginRequest,
)
from app.services.tencent_sms import (
    TencentSmsConfigError,
    TencentSmsDeliveryError,
    send_login_verification_code,
)
from app.services.runtime_state import (
    check_rate_limit,
    cleanup_auth_runtime_state,
    delete_login_code_state,
    delete_qr_session_state,
    get_login_code_state,
    get_qr_session_state,
    set_login_code_state,
    set_qr_session_state,
)
from app.services.user_display_id import ensure_user_display_id, generate_unique_display_id
from app.utils.datetime import utcnow_naive
from app.utils.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    REFRESH_COOKIE_NAME,
    set_auth_cookies,
    verify_password,
)

router = APIRouter()
CODE_EXPIRE_SECONDS = settings.AUTH_CODE_EXPIRE_SECONDS
QR_EXPIRE_SECONDS = 180
ADMIN_STATIC_CODE = settings.AUTH_ADMIN_STATIC_CODE
WECHAT_CONNECT_URL = "https://open.weixin.qq.com/connect/qrconnect"
WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token"
WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo"


# #region debug-point B:auth-route
def _debug_report(hypothesis_id: str, location: str, msg: str, data: dict | None = None) -> None:
    import os

    payload = {
        "sessionId": "auth-login-500",
        "runId": "pre-fix",
        "hypothesisId": hypothesis_id,
        "location": location,
        "msg": f"[DEBUG] {msg}",
        "data": data or {},
    }
    url = "http://127.0.0.1:7777/event"
    env_path = os.path.join(".dbg", "auth-login-500.env")
    try:
        with open(env_path, encoding="utf-8") as env_file:
            for line in env_file:
                if line.startswith("DEBUG_SERVER_URL="):
                    url = line.split("=", 1)[1].strip() or url
                elif line.startswith("DEBUG_SESSION_ID="):
                    payload["sessionId"] = line.split("=", 1)[1].strip() or payload["sessionId"]
    except Exception:
        pass
    try:
        urllib.request.urlopen(
            urllib.request.Request(
                url,
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            ),
            timeout=0.8,
        ).read()
    except Exception:
        pass
# #endregion


def _is_expired(expires_at: datetime) -> bool:
    return datetime.now(timezone.utc) >= expires_at


def _is_admin_phone(phone: str) -> bool:
    return phone in settings.auth_admin_phone_set


def _should_bypass_sms_for_dev(phone: str) -> bool:
    return settings.AUTH_DEV_SMS_BYPASS_ENABLED and not _is_admin_phone(phone)


async def _enforce_runtime_rate_limit(namespace: str, key: str, *, limit: int, detail: str) -> None:
    allowed, _ = await check_rate_limit(
        namespace,
        key,
        limit=limit,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail=detail)


async def _consume_login_code(phone: str, code: str) -> None:
    session = await get_login_code_state(phone)
    if not session:
        raise HTTPException(status_code=400, detail="请先获取验证码")
    if _is_expired(session["expires_at"]):
        await delete_login_code_state(phone)
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    verify_errors = int(session.get("verify_errors", 0))
    if verify_errors >= settings.AUTH_CODE_MAX_VERIFY_ERRORS:
        await delete_login_code_state(phone)
        raise HTTPException(status_code=429, detail="验证码错误次数过多，请重新获取")
    if session["code"] != code:
        session["verify_errors"] = verify_errors + 1
        await set_login_code_state(phone, session)
        raise HTTPException(status_code=400, detail="验证码错误")

    await delete_login_code_state(phone)


def _build_token_response(user_id) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


def _issue_auth_tokens(response: Response, user_id) -> TokenResponse:
    token_response = _build_token_response(user_id)
    set_auth_cookies(response, token_response.access_token, token_response.refresh_token)
    return token_response


def _mask_phone(phone: str | None, is_phone_bound: bool) -> str:
    if not phone or not is_phone_bound:
        return ""
    if len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[-4:]


def _resolve_default_nickname(phone: str, nickname: str | None = None) -> str:
    normalized_nickname = (nickname or "").strip()
    if normalized_nickname:
        return normalized_nickname
    return phone.strip()


def _sync_registration_phone(user: User, phone: str) -> bool:
    normalized_phone = (phone or "").strip()
    if not normalized_phone:
        return False
    if (user.registered_phone or "").strip():
        return False
    user.registered_phone = normalized_phone
    return True


def _mark_login_success(user: User, phone: str) -> None:
    normalized_phone = (phone or "").strip()
    if normalized_phone:
        user.last_login_phone = normalized_phone
    user.last_login_at = utcnow_naive()


def _is_real_wechat_login_enabled() -> bool:
    return bool(settings.WECHAT_LOGIN_ENABLED)


def _ensure_wechat_open_configured() -> None:
    if not _is_real_wechat_login_enabled():
        raise HTTPException(status_code=403, detail="当前环境未开启真实微信扫码登录")
    missing = [
        name
        for name, value in (
            ("WECHAT_OPEN_APP_ID", settings.WECHAT_OPEN_APP_ID),
            ("WECHAT_OPEN_APP_SECRET", settings.WECHAT_OPEN_APP_SECRET),
            ("WECHAT_OPEN_REDIRECT_URI", settings.WECHAT_OPEN_REDIRECT_URI),
        )
        if not str(value or "").strip()
    ]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"微信开放平台配置不完整：{', '.join(missing)}",
        )


def _resolve_wechat_redirect_uri() -> str:
    redirect_uri = settings.WECHAT_OPEN_REDIRECT_URI.strip()
    if not redirect_uri:
        return redirect_uri

    parsed = urlsplit(redirect_uri)
    normalized_path = parsed.path or ""
    if normalized_path.endswith("/wx/callback") or normalized_path.endswith("/wx/callback/index.html"):
        normalized_path = "/"

    return urlunsplit((parsed.scheme, parsed.netloc, normalized_path, parsed.query, parsed.fragment))


def _build_wechat_authorize_url(session_id: str) -> str:
    params = urlencode(
        {
            "appid": settings.WECHAT_OPEN_APP_ID.strip(),
            "redirect_uri": _resolve_wechat_redirect_uri(),
            "response_type": "code",
            "scope": "snsapi_login",
            "state": session_id,
        }
    )
    return f"{WECHAT_CONNECT_URL}?{params}#wechat_redirect"


async def _fetch_wechat_json(url: str, params: dict[str, str]) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"微信开放平台请求失败：{exc}") from exc
    if isinstance(payload, dict) and payload.get("errcode"):
        message = str(payload.get("errmsg") or payload["errcode"])
        raise HTTPException(status_code=400, detail=f"微信授权失败：{message}")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="微信开放平台返回格式异常")
    return payload


async def _fetch_wechat_profile(code: str) -> dict[str, str]:
    _ensure_wechat_open_configured()
    token_payload = await _fetch_wechat_json(
        WECHAT_ACCESS_TOKEN_URL,
        {
            "appid": settings.WECHAT_OPEN_APP_ID.strip(),
            "secret": settings.WECHAT_OPEN_APP_SECRET.strip(),
            "code": code,
            "grant_type": "authorization_code",
        },
    )
    access_token = str(token_payload.get("access_token") or "").strip()
    openid = str(token_payload.get("openid") or "").strip()
    if not access_token or not openid:
        raise HTTPException(status_code=400, detail="微信授权结果缺少 access_token 或 openid")
    userinfo_payload = await _fetch_wechat_json(
        WECHAT_USERINFO_URL,
        {
            "access_token": access_token,
            "openid": openid,
        },
    )
    nickname = str(userinfo_payload.get("nickname") or "").strip()[:50]
    avatar_url = str(userinfo_payload.get("headimgurl") or "").strip() or None
    return {
        "openid": openid,
        "nickname": nickname or openid,
        "avatar_url": avatar_url,
    }


async def _find_user_by_wechat_openid(db: AsyncSession, openid: str) -> User | None:
    result = await db.execute(select(User).where(User.wechat_openid == openid))
    return result.scalar_one_or_none()


async def _apply_wechat_binding(user: User, profile: dict[str, str | None], db: AsyncSession) -> None:
    openid = str(profile.get("openid") or "").strip()
    if not openid:
        raise HTTPException(status_code=400, detail="微信身份信息缺少 openid")
    existing = await _find_user_by_wechat_openid(db, openid)
    if existing and existing.id != user.id:
        raise HTTPException(status_code=400, detail="该微信已绑定其他账号")
    user.wechat_openid = openid
    user.wechat_nickname = str(profile.get("nickname") or openid).strip()[:50]
    user.wechat_avatar_url = str(profile.get("avatar_url") or "").strip() or None
    user.wechat_bound_at = utcnow_naive()


async def _set_qr_session_error(session_id: str, session: dict, message: str) -> None:
    session["status"] = "error"
    session["message"] = message
    await set_qr_session_state(session_id, session)


async def _process_real_wechat_callback(session_id: str, code: str, db: AsyncSession) -> tuple[str, str]:
    cleanup_auth_runtime_state()
    session = await get_qr_session_state(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="扫码会话不存在或已过期")
    if _is_expired(session["expires_at"]):
        await delete_qr_session_state(session_id)
        raise HTTPException(status_code=400, detail="二维码已过期，请重新扫码")

    profile = await _fetch_wechat_profile(code)
    kind = str(session.get("kind") or "login")

    if kind == "bind":
        raw_user_id = str(session.get("user_id") or "").strip()
        if not raw_user_id:
            await _set_qr_session_error(session_id, session, "绑定会话缺少用户信息")
            raise HTTPException(status_code=400, detail="绑定会话缺少用户信息")
        try:
            user_id = uuid.UUID(raw_user_id)
        except ValueError as exc:
            await _set_qr_session_error(session_id, session, "绑定会话用户标识非法")
            raise HTTPException(status_code=400, detail="绑定会话用户标识非法") from exc
        user = await db.get(User, user_id)
        if not user or not user.is_active:
            await _set_qr_session_error(session_id, session, "当前账号不可用，请重新登录后再绑定")
            raise HTTPException(status_code=400, detail="当前账号不可用，请重新登录后再绑定")
        await _apply_wechat_binding(user, profile, db)
        await db.commit()
        await db.refresh(user)
        session["status"] = "confirmed"
        session["wechat_nickname"] = user.wechat_nickname
        session["message"] = "微信绑定成功，请返回原页面查看"
        await set_qr_session_state(session_id, session)
        return "confirmed", str(session["message"])

    bound_user = await _find_user_by_wechat_openid(db, profile["openid"])
    if bound_user:
        if not bound_user.is_active:
            await _set_qr_session_error(session_id, session, "该微信绑定账号已不可用，请联系客服处理")
            raise HTTPException(status_code=403, detail="该微信绑定账号已不可用")
        await _apply_wechat_binding(bound_user, profile, db)
        _mark_login_success(bound_user, bound_user.phone)
        await db.commit()
        await db.refresh(bound_user)
        session["status"] = "confirmed"
        session["tokens"] = {
            "access_token": create_access_token(bound_user.id),
            "refresh_token": create_refresh_token(bound_user.id),
        }
        session["message"] = "微信登录成功，请返回电脑端继续操作"
        await set_qr_session_state(session_id, session)
        return "confirmed", str(session["message"])

    session["status"] = "need_bind_mobile"
    session["bind_token"] = session_id
    session["wechat_profile"] = profile
    session["message"] = "微信扫码成功，请返回电脑端绑定手机号"
    await set_qr_session_state(session_id, session)
    return "need_bind_mobile", str(session["message"])


async def _get_or_create_user(phone: str, db: AsyncSession, nickname: str | None = None) -> User:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        if not user.is_active:
            raise HTTPException(status_code=403, detail="账号已注销，无法继续登录")
        expected_admin = _is_admin_phone(phone)
        needs_display_id = not user.display_id
        registration_changed = _sync_registration_phone(user, phone)
        _mark_login_success(user, phone)
        if user.is_admin != expected_admin or registration_changed:
            user.is_admin = expected_admin
            await db.commit()
            await db.refresh(user)
        else:
            await db.commit()
            await db.refresh(user)
        if needs_display_id:
            await ensure_user_display_id(user, db)
        return user

    user = User(
        display_id=await generate_unique_display_id(db),
        phone=phone,
        registered_phone=phone,
        last_login_phone=phone,
        last_login_at=utcnow_naive(),
        password_hash=hash_password(secrets.token_urlsafe(12)),
        nickname=_resolve_default_nickname(phone, nickname),
        is_admin=_is_admin_phone(phone),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post(
    "/register",
    response_model=TokenResponse,
    summary="注册账号",
    description="使用手机号、密码和昵称创建新账号。注册成功后直接返回 access token 与 refresh token。",
    response_description="注册成功后的登录 token。",
)
async def register(req: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.phone == req.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已注册")

    user = User(
        display_id=await generate_unique_display_id(db),
        phone=req.phone,
        registered_phone=req.phone,
        last_login_phone=req.phone,
        last_login_at=utcnow_naive(),
        password_hash=hash_password(req.password),
        nickname=_resolve_default_nickname(req.phone, req.nickname),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _issue_auth_tokens(response, user.id)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="手机号密码登录",
    description="使用手机号和密码登录。登录成功后返回 access token 与 refresh token，并同步写入鉴权 cookie。",
    response_description="登录成功后的 token。",
    responses={
        200: {
            "description": "登录成功",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh",
                        "token_type": "bearer",
                    }
                }
            },
        }
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "phone": "13800000000",
                        "password": "123456",
                    }
                }
            }
        }
    },
)
async def login(req: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.phone == req.phone, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    _sync_registration_phone(user, req.phone)
    _mark_login_success(user, req.phone)
    await db.commit()
    await db.refresh(user)
    return _issue_auth_tokens(response, user.id)


@router.post(
    "/send-code",
    response_model=SendCodeResponse,
    summary="发送短信验证码",
    description="向指定手机号发送验证码。开发态可开启调试验证码回显，管理员手机号可使用静态验证码。",
    response_description="验证码发送结果与有效期信息。",
    responses={
        200: {
            "description": "发送成功",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "开发态已跳过真实短信发送，请使用调试验证码登录",
                        "expires_in": 300,
                        "debug_code": "666666",
                    }
                }
            },
        }
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "phone": "13800000000",
                    }
                }
            }
        }
    },
)
async def send_login_code(req: SendCodeRequest):
    await _enforce_runtime_rate_limit(
        "auth-send-code",
        req.phone.strip(),
        limit=settings.AUTH_SEND_CODE_RATE_LIMIT,
        detail="验证码请求过于频繁，请稍后再试",
    )
    cleanup_auth_runtime_state()
    now = datetime.now(timezone.utc)
    state = await get_login_code_state(req.phone)
    if state:
        last_sent_at = state.get("last_sent_at")
        if isinstance(last_sent_at, datetime):
            elapsed = (now - last_sent_at).total_seconds()
            if elapsed < settings.AUTH_CODE_RESEND_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail=f"发送过于频繁，请 {int(settings.AUTH_CODE_RESEND_SECONDS - elapsed)} 秒后重试",
                )
        last_sent_date = state.get("sent_date")
        send_count = int(state.get("send_count", 0))
        if last_sent_date == date.today() and send_count >= settings.AUTH_CODE_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="今日验证码发送次数已达上限")
        if last_sent_date != date.today():
            send_count = 0
    else:
        send_count = 0

    is_admin_phone = _is_admin_phone(req.phone)
    is_dev_bypass_phone = _should_bypass_sms_for_dev(req.phone)
    code = (
        ADMIN_STATIC_CODE
        if is_admin_phone
        else settings.AUTH_DEV_SMS_BYPASS_CODE
        if is_dev_bypass_phone
        else f"{secrets.randbelow(1000000):06d}"
    )
    if not is_admin_phone and not is_dev_bypass_phone:
        try:
            await send_login_verification_code(req.phone, code)
        except TencentSmsConfigError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except TencentSmsDeliveryError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    await set_login_code_state(req.phone, {
        "code": code,
        "expires_at": now + timedelta(seconds=CODE_EXPIRE_SECONDS),
        "last_sent_at": now,
        "sent_date": date.today(),
        "send_count": send_count + 1,
        "verify_errors": 0,
    })
    return SendCodeResponse(
        message=(
            "管理员账号已启用静态验证码"
            if is_admin_phone
            else "开发态已跳过真实短信发送，请使用调试验证码登录"
            if is_dev_bypass_phone
            else "验证码发送成功，请注意查收短信"
        ),
        expires_in=CODE_EXPIRE_SECONDS,
        debug_code=code if settings.AUTH_DEBUG_CODE_ENABLED else None,
    )


@router.post(
    "/verify-code-login",
    response_model=TokenResponse,
    summary="验证码登录",
    description="使用手机号和验证码登录。若手机号尚未注册，会自动创建账号并返回登录 token。",
    response_description="登录成功后的 token。",
    responses={
        200: {
            "description": "登录成功",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access",
                        "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh",
                        "token_type": "bearer",
                    }
                }
            },
        }
    },
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "phone": "13800000000",
                        "code": "666666",
                    }
                }
            }
        }
    },
)
async def verify_code_login(req: VerifyCodeLoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # #region debug-point B:verify-enter
    _debug_report(
        "B",
        "auth.py:verify-enter",
        "verify-code-login handler entered",
        {
            "phone_suffix": req.phone[-4:] if req.phone else "",
        },
    )
    # #endregion
    cleanup_auth_runtime_state()
    await _consume_login_code(req.phone, req.code)
    # #region debug-point B:verify-code-consumed
    _debug_report(
        "B",
        "auth.py:verify-code-consumed",
        "verify-code-login consumed code successfully",
        {
            "phone_suffix": req.phone[-4:] if req.phone else "",
        },
    )
    # #endregion
    user = await _get_or_create_user(req.phone, db)
    # #region debug-point B:verify-user-ready
    _debug_report(
        "B",
        "auth.py:verify-user-ready",
        "verify-code-login resolved user",
        {
            "user_id": str(user.id),
            "is_admin": bool(user.is_admin),
        },
    )
    # #endregion
    return _issue_auth_tokens(response, user.id)


@router.get(
    "/wechat/qrcode",
    response_model=QrCodeSessionResponse,
    summary="创建微信扫码登录会话",
    description="生成开发态微信扫码登录会话，返回二维码内容与会话有效期。",
    response_description="扫码登录会话信息。",
)
async def create_wechat_qrcode():
    if not _is_real_wechat_login_enabled() and not settings.AUTH_DEV_WECHAT_CONFIRM_ENABLED:
        raise HTTPException(status_code=403, detail="当前环境未开启微信扫码登录")
    cleanup_auth_runtime_state()
    session_id = secrets.token_urlsafe(18)
    qr_value = (
        _build_wechat_authorize_url(session_id)
        if _is_real_wechat_login_enabled()
        else f"miioo://auth/wechat?session={session_id}"
    )
    await set_qr_session_state(session_id, {
        "status": "pending",
        "kind": "login",
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=QR_EXPIRE_SECONDS),
        "tokens": None,
        "bind_token": None,
        "message": None,
    })
    return QrCodeSessionResponse(
        session_id=session_id,
        qr_code_value=qr_value,
        expires_in=QR_EXPIRE_SECONDS,
        status="pending",
    )


@router.get(
    "/wechat/poll/{session_id}",
    response_model=QrCodePollResponse,
    summary="轮询微信扫码状态",
    description="轮询扫码登录会话状态。若状态为 confirmed，则返回 token 并写入鉴权 cookie。",
    response_description="扫码状态，必要时附带 token。",
)
async def poll_wechat_login(session_id: str, response: Response):
    await _enforce_runtime_rate_limit(
        "auth-wechat-poll",
        session_id,
        limit=settings.AUTH_QR_POLL_RATE_LIMIT,
        detail="二维码轮询过于频繁，请稍后再试",
    )
    cleanup_auth_runtime_state()
    session = await get_qr_session_state(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="扫码会话不存在")
    if _is_expired(session["expires_at"]):
        await delete_qr_session_state(session_id)
        return QrCodePollResponse(status="expired")
    if session["status"] == "need_bind_mobile":
        return QrCodePollResponse(
            status="need_bind_mobile",
            bind_token=str(session.get("bind_token") or session_id),
            message=session.get("message"),
        )
    if session["status"] != "confirmed":
        return QrCodePollResponse(
            status=session["status"],
            message=session.get("message"),
        )

    tokens = session["tokens"]
    if not tokens:
        await delete_qr_session_state(session_id)
        raise HTTPException(status_code=400, detail="扫码会话缺少登录令牌，请重新扫码")
    set_auth_cookies(response, tokens["access_token"], tokens["refresh_token"])
    await delete_qr_session_state(session_id)
    return QrCodePollResponse(
        status="confirmed",
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@router.post(
    "/wechat/confirm",
    response_model=QrCodePollResponse,
    summary="确认微信扫码登录",
    description="开发态下确认指定扫码会话，并将手机号绑定到本次登录流程。",
    response_description="确认结果。",
)
async def confirm_wechat_login(req: QrCodeConfirmRequest, db: AsyncSession = Depends(get_db)):
    if _is_real_wechat_login_enabled():
        cleanup_auth_runtime_state()
        session = await get_qr_session_state(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="扫码会话不存在")
        if _is_expired(session["expires_at"]):
            await delete_qr_session_state(req.session_id)
            raise HTTPException(status_code=400, detail="二维码已过期，请刷新后重试")
        if session.get("status") != "need_bind_mobile":
            raise HTTPException(status_code=400, detail="当前扫码会话无需绑定手机号")

        provided_code = (req.sms_code or req.code or "").strip()
        if not provided_code:
            raise HTTPException(status_code=400, detail="请输入验证码")
        await _consume_login_code(req.phone, provided_code)

        profile = session.get("wechat_profile")
        if not isinstance(profile, dict):
            raise HTTPException(status_code=400, detail="微信身份信息不存在，请重新扫码")
        user = await _get_or_create_user(req.phone, db, req.nickname or str(profile.get("nickname") or ""))
        await _apply_wechat_binding(user, profile, db)
        await db.commit()
        await db.refresh(user)
        session["status"] = "confirmed"
        session["bind_token"] = None
        session["tokens"] = {
            "access_token": create_access_token(user.id),
            "refresh_token": create_refresh_token(user.id),
        }
        session["message"] = "绑定成功，正在为你登录"
        await set_qr_session_state(req.session_id, session)
        return QrCodePollResponse(status="confirmed")

    if not settings.AUTH_DEV_WECHAT_CONFIRM_ENABLED:
        raise HTTPException(status_code=403, detail="当前环境未开启开发态微信登录")
    cleanup_auth_runtime_state()
    session = await get_qr_session_state(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="扫码会话不存在")
    if _is_expired(session["expires_at"]):
        await delete_qr_session_state(req.session_id)
        raise HTTPException(status_code=400, detail="二维码已过期，请刷新后重试")

    provided_code = (req.sms_code or req.code or "").strip()
    if not provided_code:
        raise HTTPException(status_code=400, detail="请输入验证码")
    await _consume_login_code(req.phone, provided_code)

    user = await _get_or_create_user(req.phone, db, req.nickname)
    session["status"] = "confirmed"
    session["tokens"] = {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
    }
    await set_qr_session_state(req.session_id, session)
    return QrCodePollResponse(status="confirmed")


@router.post(
    "/wechat/callback/complete",
    response_model=WechatCallbackCompleteResponse,
    summary="处理微信扫码回调",
    description="供前端首页或兼容回调页调用，使用微信回调 code 完成真实扫码登录或资料页绑定。",
    response_description="微信回调处理结果。",
)
async def complete_wechat_callback(
    req: WechatCallbackCompleteRequest,
    db: AsyncSession = Depends(get_db),
):
    status_value, message = await _process_real_wechat_callback(req.state, req.code, db)
    return WechatCallbackCompleteResponse(
        success=True,
        status=status_value,
        message=message,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="刷新登录态",
    description="使用 refresh token 刷新 access token。可从请求体传入，也可从 cookie 自动读取。",
    response_description="新的 access token 与 refresh token。",
)
async def refresh(
    request: Request,
    response: Response,
    req: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = req.refresh_token if req else request.cookies.get(REFRESH_COOKIE_NAME)
    payload = decode_token(refresh_token) if refresh_token else None
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的 refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    return _issue_auth_tokens(response, user.id)


@router.post(
    "/logout",
    summary="退出登录",
    description="清理服务端设置的鉴权 cookie。若前端自行持久化 token，仍需要同步清理本地存储。",
    response_description="退出登录结果。",
)
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"message": "已退出登录"}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="获取当前用户",
    description="返回当前登录用户的展示信息，并补充 `has_api_configured` 供前端做 API 配置门禁判断。",
    response_description="当前登录用户信息。",
    responses={
        200: {
            "description": "获取成功",
            "content": {
                "application/json": {
                    "example": {
                        "id": "9a8b7c6d-1234-4abc-90de-1234567890ab",
                        "display_id": "miioo_123456",
                        "phone": "138****0000",
                        "phone_bound": True,
                        "nickname": "阿星",
                        "avatar_url": None,
                        "wechat": None,
                        "wechat_nickname": None,
                        "wechat_bound": False,
                        "has_api_configured": True,
                        "is_admin": False,
                    }
                }
            },
        }
    },
)
async def get_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await ensure_user_display_id(user, db)
    result = await db.execute(
        select(ApiProvider).where(ApiProvider.user_id == user.id, ApiProvider.is_enabled == True)
    )
    has_api = result.first() is not None

    return UserResponse(
        id=str(user.id),
        display_id=user.display_id,
        phone=_mask_phone(user.phone, bool(getattr(user, "is_phone_bound", True))),
        phone_bound=bool(getattr(user, "is_phone_bound", True)),
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        wechat=(user.wechat_nickname or user.wechat_openid or None),
        wechat_nickname=(user.wechat_nickname or None),
        wechat_bound=bool(user.wechat_openid),
        has_api_configured=has_api,
        is_admin=bool(user.is_admin),
    )
