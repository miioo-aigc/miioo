import secrets
import re
import uuid
from urllib.parse import urlencode, urlsplit, urlunsplit
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_admin_user, get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse
from app.schemas.user import (
    AdminUserAccountItem,
    AdminUserAccountListResponse,
    AdminUserAccountUpdateRequest,
    BindWechatRequest,
    ConfirmPhoneRebindRequest,
    SendPhoneRebindCodeRequest,
    UpdateUserRequest,
    WechatBindPollResponse,
    WechatBindQrCodeResponse,
)
from app.services.avatar_upload import (
    AVATAR_OUTPUT_CONTENT_TYPE,
    AVATAR_OUTPUT_EXTENSION,
    AvatarUploadError,
    compress_avatar_image,
)
from app.services.runtime_state import (
    check_rate_limit,
    cleanup_auth_runtime_state,
    cleanup_phone_rebind_runtime_state,
    delete_qr_session_state,
    delete_phone_rebind_code_state,
    get_qr_session_state,
    get_phone_rebind_code_state,
    set_qr_session_state,
    set_phone_rebind_code_state,
)
from app.services.media_storage import (
    build_upload_url,
    delete_managed_upload,
    resolve_upload_dir,
)
from app.services.tencent_sms import (
    TencentSmsConfigError,
    TencentSmsDeliveryError,
    send_login_verification_code,
)
from app.services.user_display_id import ensure_user_display_id
from app.utils.datetime import serialize_utc_datetime, utcnow_naive

router = APIRouter()
CODE_EXPIRE_SECONDS = settings.AUTH_CODE_EXPIRE_SECONDS
WECHAT_BIND_QR_EXPIRE_SECONDS = 180
NICKNAME_ALLOWED_PATTERN = re.compile(r"^[A-Za-z0-9\u4e00-\u9fff _.\-·]+$")
NICKNAME_SENSITIVE_WORDS = (
    "管理员",
    "客服",
    "官方",
    "系统",
    "老板",
    "傻逼",
    "妈的",
    "操你",
    "习近平",
    "法轮功",
)


def _is_expired(expires_at: datetime) -> bool:
    return datetime.now(timezone.utc) >= expires_at


def _contains_sensitive_word(value: str) -> bool:
    lowered = value.lower()
    return any(word.lower() in lowered for word in NICKNAME_SENSITIVE_WORDS)


def _validate_nickname(raw_value: str) -> str:
    value = raw_value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="用户名不能为空")
    if len(value) > 50:
        raise HTTPException(status_code=400, detail="用户名不能超过 50 个字符")
    if _contains_sensitive_word(value):
        raise HTTPException(status_code=400, detail="用户名包含敏感词，请重新输入")
    if not NICKNAME_ALLOWED_PATTERN.fullmatch(value):
        raise HTTPException(
            status_code=400,
            detail="用户名仅支持中文、英文、数字、空格、下划线、中划线、点和中点",
        )
    return value


def _mask_phone(phone: str | None, is_phone_bound: bool) -> str:
    if not phone or not is_phone_bound:
        return ""
    if len(phone) < 7:
        return phone
    return phone[:3] + "****" + phone[-4:]


def _normalize_phone(raw_value: str) -> str:
    value = raw_value.strip()
    if not re.fullmatch(r"\d{11}", value):
        raise HTTPException(status_code=400, detail="请输入正确的 11 位手机号")
    return value


def _is_real_wechat_login_enabled() -> bool:
    return bool(settings.WECHAT_LOGIN_ENABLED)


def _ensure_wechat_open_configured() -> None:
    if not _is_real_wechat_login_enabled():
        raise HTTPException(status_code=403, detail="当前环境未开启真实微信绑定")
    missing = [
        name
        for name, value in (
            ("WECHAT_OPEN_APP_ID", settings.WECHAT_OPEN_APP_ID),
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


def _build_wechat_authorize_url(ticket: str) -> str:
    params = urlencode(
        {
            "appid": settings.WECHAT_OPEN_APP_ID.strip(),
            "redirect_uri": _resolve_wechat_redirect_uri(),
            "response_type": "code",
            "scope": "snsapi_login",
            "state": ticket,
        }
    )
    return f"https://open.weixin.qq.com/connect/qrconnect?{params}#wechat_redirect"


async def _build_user_response(
    user: User,
    db: AsyncSession,
    *,
    has_api_configured: bool = False,
) -> UserResponse:
    await ensure_user_display_id(user, db)
    wechat_display = (user.wechat_nickname or user.wechat_openid or "").strip() or None
    return UserResponse(
        id=str(user.id),
        display_id=user.display_id,
        phone=_mask_phone(user.phone, bool(user.is_phone_bound)),
        phone_bound=bool(user.is_phone_bound),
        nickname=user.nickname or "",
        avatar_url=user.avatar_url,
        wechat=wechat_display,
        wechat_nickname=(user.wechat_nickname or None),
        wechat_bound=bool(user.wechat_openid),
        has_api_configured=has_api_configured,
        is_admin=bool(user.is_admin),
    )


def _assert_bind_session_owner(session: dict, user: User) -> None:
    session_user_id = str(session.get("user_id") or "").strip()
    if session_user_id != str(user.id):
        raise HTTPException(status_code=403, detail="该扫码绑定会话不属于当前账号")


def _serialize_datetime(value: datetime | None) -> str | None:
    return serialize_utc_datetime(value)


def _build_admin_user_account_item(user: User) -> AdminUserAccountItem:
    return AdminUserAccountItem(
        id=str(user.id),
        display_id=user.display_id,
        nickname=user.nickname or "",
        current_phone=(user.phone or "").strip(),
        registered_phone=(user.registered_phone or user.phone or "").strip() or None,
        last_login_phone=(user.last_login_phone or "").strip() or None,
        last_login_at=_serialize_datetime(user.last_login_at),
        is_admin=bool(user.is_admin),
        is_active=bool(user.is_active),
        created_at=_serialize_datetime(user.created_at),
        updated_at=_serialize_datetime(user.updated_at),
    )


async def _assert_phone_available_for_user(db: AsyncSession, phone: str, user_id: uuid.UUID) -> None:
    existing = await db.execute(select(User).where(User.phone == phone, User.id != user_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已绑定其他账号")


async def _ensure_active_admin_guard(
    db: AsyncSession,
    target_user: User,
    *,
    next_is_admin: bool,
    next_is_active: bool,
) -> None:
    is_removing_last_active_admin = bool(target_user.is_admin) and bool(target_user.is_active) and not (
        next_is_admin and next_is_active
    )
    if not is_removing_last_active_admin:
        return

    active_admin_total = int(
        (
            await db.execute(
                select(func.count()).select_from(User).where(
                    User.is_admin == True,
                    User.is_active == True,
                )
            )
        ).scalar_one()
        or 0
    )
    if active_admin_total <= 1:
        raise HTTPException(status_code=400, detail="至少保留一个启用中的管理员账号")


async def _apply_admin_user_account_update(
    target_user: User,
    req: AdminUserAccountUpdateRequest,
    db: AsyncSession,
) -> User:
    if req.nickname is not None:
        target_user.nickname = _validate_nickname(req.nickname)

    if req.phone is not None:
        next_phone = _normalize_phone(req.phone)
        await _assert_phone_available_for_user(db, next_phone, target_user.id)
        target_user.phone = next_phone
        target_user.is_phone_bound = True

    next_is_admin = bool(req.is_admin) if req.is_admin is not None else bool(target_user.is_admin)
    next_is_active = bool(req.is_active) if req.is_active is not None else bool(target_user.is_active)
    await _ensure_active_admin_guard(
        db,
        target_user,
        next_is_admin=next_is_admin,
        next_is_active=next_is_active,
    )
    target_user.is_admin = next_is_admin
    target_user.is_active = next_is_active

    await db.commit()
    await db.refresh(target_user)
    return target_user


@router.get(
    "/admin/accounts",
    response_model=AdminUserAccountListResponse,
    summary="管理员读取账号列表",
    description="仅管理员可调用。分页读取账号列表，并返回当前手机号、注册手机号、最近登录手机号与最近登录时间，便于账号管理查看。",
    response_description="管理员账号管理列表。",
)
async def list_admin_user_accounts(
    page: int = Query(1, ge=1, description="页码，从 1 开始。"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量，默认 20。"),
    keyword: str | None = Query(None, description="按昵称、展示号或手机号模糊搜索。"),
    is_active: bool | None = Query(None, description="按账号启用状态筛选。"),
    is_admin: bool | None = Query(None, description="按管理员身份筛选。"),
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    del admin_user

    conditions = []
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        search = f"%{normalized_keyword}%"
        conditions.append(
            or_(
                User.nickname.ilike(search),
                User.display_id.ilike(search),
                User.phone.ilike(search),
                User.registered_phone.ilike(search),
                User.last_login_phone.ilike(search),
            )
        )
    if is_active is not None:
        conditions.append(User.is_active == is_active)
    if is_admin is not None:
        conditions.append(User.is_admin == is_admin)

    total_stmt = select(func.count()).select_from(User)
    if conditions:
        total_stmt = total_stmt.where(*conditions)
    total = int((await db.execute(total_stmt)).scalar_one() or 0)

    stmt = select(User).order_by(User.created_at.desc(), User.id.desc())
    if conditions:
        stmt = stmt.where(*conditions)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    users = list((await db.execute(stmt)).scalars().all())

    return AdminUserAccountListResponse(
        list=[_build_admin_user_account_item(user) for user in users],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.patch(
    "/admin/accounts/{user_id}",
    response_model=AdminUserAccountItem,
    summary="管理员更新账号信息",
    description="仅管理员可调用。支持更新账号昵称、手机号、启用状态与管理员状态。",
    response_description="更新后的管理员账号信息。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "nickname": "内容运营A",
                        "phone": "13900001111",
                        "is_admin": True,
                        "is_active": True,
                    }
                }
            }
        }
    },
)
async def update_admin_user_account(
    user_id: uuid.UUID,
    req: AdminUserAccountUpdateRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
):
    del admin_user

    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="目标账号不存在")

    updated_user = await _apply_admin_user_account_update(target_user, req, db)
    return _build_admin_user_account_item(updated_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="更新个人资料",
    description="更新当前登录用户的个人资料。当前主要支持修改用户名和头像地址，成功后返回最新用户信息。",
    response_description="更新后的当前用户信息。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "nickname": "创作者A",
                        "avatar_url": "/uploads/images/avatar.png",
                    }
                }
            }
        }
    },
)
async def update_profile(req: UpdateUserRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    previous_avatar_url = user.avatar_url
    if req.nickname is not None:
        user.nickname = _validate_nickname(req.nickname)
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url

    await db.commit()
    await db.refresh(user)

    if req.avatar_url is not None and previous_avatar_url and previous_avatar_url != user.avatar_url:
        delete_managed_upload(previous_avatar_url)

    return await _build_user_response(user, db)


@router.post(
    "/me/avatar",
    response_model=dict,
    summary="上传头像",
    description="上传并压缩当前登录用户头像，成功后返回可直接写入 `avatar_url` 的 `/uploads/...` 地址。",
    response_description="上传成功后的头像地址。",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "properties": {
                            "file": {
                                "type": "string",
                                "format": "binary",
                            }
                        },
                        "required": ["file"],
                    }
                }
            },
        }
    },
)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/avif",
    }
    content_type = (file.content_type or "").split(";", 1)[0].strip().lower()
    if content_type not in allowed_content_types:
        raise HTTPException(status_code=400, detail="头像仅支持 JPG、PNG、WebP、AVIF 格式")

    raw_content = await file.read()
    try:
        compressed = compress_avatar_image(raw_content)
    except AvatarUploadError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    upload_dir = resolve_upload_dir("avatars")
    filename = f"{uuid.uuid4().hex}{AVATAR_OUTPUT_EXTENSION}"
    file_path = upload_dir / filename
    file_path.write_bytes(compressed)

    return {
        "url": build_upload_url("avatars", filename),
        "content_type": AVATAR_OUTPUT_CONTENT_TYPE,
        "size": len(compressed),
    }


@router.post(
    "/me/phone/rebind/send-code",
    summary="发送换绑手机号验证码",
    description="向新手机号发送换绑验证码。仅当当前账号已绑定手机号时允许调用，并复用现有验证码限流与开发态调试能力。",
    response_description="验证码发送结果与有效期信息。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "phone": "13900001111",
                    }
                }
            }
        }
    },
)
async def send_phone_rebind_code(
    req: SendPhoneRebindCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed, _ = await check_rate_limit(
        "phone-rebind-send-code",
        str(user.id),
        limit=settings.AUTH_SEND_CODE_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
    )
    if not allowed:
        raise HTTPException(status_code=429, detail="换绑验证码请求过于频繁，请稍后再试")
    cleanup_phone_rebind_runtime_state()
    if not user.is_phone_bound:
        raise HTTPException(status_code=400, detail="当前账号未绑定手机号，无法换绑")

    next_phone = req.phone.strip()
    if not re.fullmatch(r"\d{11}", next_phone):
        raise HTTPException(status_code=400, detail="请输入正确的 11 位手机号")
    if next_phone == (user.phone or "").strip():
        raise HTTPException(status_code=400, detail="新手机号不能与当前手机号一致")

    existing = await db.execute(select(User).where(User.phone == next_phone, User.id != user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已绑定其他账号")

    now = datetime.now(timezone.utc)
    current_state = await get_phone_rebind_code_state(str(user.id))
    if current_state:
        last_sent_at = current_state.get("last_sent_at")
        if isinstance(last_sent_at, datetime):
            elapsed = (now - last_sent_at).total_seconds()
            if elapsed < settings.AUTH_CODE_RESEND_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail=f"发送过于频繁，请 {int(settings.AUTH_CODE_RESEND_SECONDS - elapsed)} 秒后重试",
                )
        last_sent_date = current_state.get("sent_date")
        send_count = int(current_state.get("send_count", 0))
        if last_sent_date == date.today() and send_count >= settings.AUTH_CODE_DAILY_LIMIT:
            raise HTTPException(status_code=429, detail="今日验证码发送次数已达上限")
        if last_sent_date != date.today():
            send_count = 0
    else:
        send_count = 0

    is_admin_phone = next_phone in settings.auth_admin_phone_set
    is_dev_bypass_phone = settings.AUTH_DEV_SMS_BYPASS_ENABLED and not is_admin_phone
    code = (
        settings.AUTH_ADMIN_STATIC_CODE
        if is_admin_phone
        else settings.AUTH_DEV_SMS_BYPASS_CODE
        if is_dev_bypass_phone
        else f"{secrets.randbelow(1000000):06d}"
    )
    if not is_admin_phone and not is_dev_bypass_phone:
        try:
            await send_login_verification_code(next_phone, code)
        except TencentSmsConfigError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except TencentSmsDeliveryError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    await set_phone_rebind_code_state(str(user.id), {
        "phone": next_phone,
        "code": code,
        "expires_at": now + timedelta(seconds=CODE_EXPIRE_SECONDS),
        "last_sent_at": now,
        "sent_date": date.today(),
        "send_count": send_count + 1,
        "verify_errors": 0,
    })
    return {
        "message": (
            "管理员账号已启用静态验证码"
            if is_admin_phone
            else "开发态已跳过真实短信发送，请使用调试验证码确认换绑"
            if is_dev_bypass_phone
            else "换绑验证码发送成功，请注意查收短信"
        ),
        "expires_in": CODE_EXPIRE_SECONDS,
        "debug_code": code if settings.AUTH_DEBUG_CODE_ENABLED else None,
    }


@router.post(
    "/me/phone/rebind",
    response_model=UserResponse,
    summary="确认换绑手机号",
    description="校验新手机号与验证码，并在通过后将当前账号绑定的手机号更新为新的号码。",
    response_description="换绑成功后的当前用户信息。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "phone": "13900001111",
                        "code": "123456",
                    }
                }
            }
        }
    },
)
async def confirm_phone_rebind(
    req: ConfirmPhoneRebindRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cleanup_phone_rebind_runtime_state()
    if not user.is_phone_bound:
        raise HTTPException(status_code=400, detail="当前账号未绑定手机号，无法换绑")

    next_phone = req.phone.strip()
    if not re.fullmatch(r"\d{11}", next_phone):
        raise HTTPException(status_code=400, detail="请输入正确的 11 位手机号")

    state = await get_phone_rebind_code_state(str(user.id))
    if not state:
        raise HTTPException(status_code=400, detail="请先获取验证码")
    if _is_expired(state["expires_at"]):
        await delete_phone_rebind_code_state(str(user.id))
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if state.get("phone") != next_phone:
        raise HTTPException(status_code=400, detail="手机号已变更，请重新获取验证码")

    verify_errors = int(state.get("verify_errors", 0))
    if verify_errors >= settings.AUTH_CODE_MAX_VERIFY_ERRORS:
        await delete_phone_rebind_code_state(str(user.id))
        raise HTTPException(status_code=429, detail="验证码错误次数过多，请重新获取")
    if state["code"] != req.code:
        state["verify_errors"] = verify_errors + 1
        await set_phone_rebind_code_state(str(user.id), state)
        raise HTTPException(status_code=400, detail="验证码错误")

    existing = await db.execute(select(User).where(User.phone == next_phone, User.id != user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已绑定其他账号")

    user.phone = next_phone
    user.is_phone_bound = True
    user.is_admin = next_phone in settings.auth_admin_phone_set
    await delete_phone_rebind_code_state(str(user.id))
    await db.commit()
    await db.refresh(user)
    return await _build_user_response(user, db)


@router.post(
    "/me/wechat/bind",
    response_model=UserResponse,
    summary="绑定微信号",
    description="为当前账号绑定一个微信号展示关系。该接口承接个人资料页最小绑定能力，不等同于完整微信 OAuth 登录闭环。",
    response_description="绑定成功后的当前用户信息。",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "wechat_id": "miioo_wechat",
                        "wechat_nickname": "微信昵称",
                        "wechat_avatar_url": "/uploads/images/wechat-avatar.png",
                    }
                }
            }
        }
    },
)
async def bind_wechat(
    req: BindWechatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wechat_id = req.wechat_id.strip()
    if not wechat_id:
        raise HTTPException(status_code=400, detail="微信号不能为空")
    if len(wechat_id) > 50:
        raise HTTPException(status_code=400, detail="微信号不能超过 50 个字符")

    existing = await db.execute(
        select(User).where(User.wechat_openid == wechat_id, User.id != user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该微信号已绑定其他账号")

    user.wechat_openid = wechat_id
    user.wechat_nickname = (req.wechat_nickname or wechat_id).strip()[:50]
    user.wechat_avatar_url = req.wechat_avatar_url
    user.wechat_bound_at = utcnow_naive()
    await db.commit()
    await db.refresh(user)
    return await _build_user_response(user, db)


@router.get(
    "/me/wechat/qrcode",
    response_model=WechatBindQrCodeResponse,
    summary="创建资料页微信绑定二维码",
    description="为当前登录账号创建真实微信扫码绑定会话，扫码成功后会在资料页轮询中返回绑定结果。",
    response_description="资料页微信绑定二维码会话信息。",
)
async def create_wechat_bind_qrcode(user: User = Depends(get_current_user)):
    _ensure_wechat_open_configured()
    cleanup_auth_runtime_state()
    ticket = secrets.token_urlsafe(18)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=WECHAT_BIND_QR_EXPIRE_SECONDS)
    await set_qr_session_state(
        ticket,
        {
            "kind": "bind",
            "user_id": str(user.id),
            "status": "pending",
            "wechat_nickname": None,
            "message": None,
            "expires_at": expires_at,
        },
    )
    return WechatBindQrCodeResponse(
        ticket=ticket,
        qr_code_value=_build_wechat_authorize_url(ticket),
        expires_in=WECHAT_BIND_QR_EXPIRE_SECONDS,
        status="pending",
    )


@router.get(
    "/me/wechat/poll/{ticket}",
    response_model=WechatBindPollResponse,
    summary="轮询资料页微信绑定状态",
    description="资料页绑定二维码轮询接口。扫码并确认后返回 confirmed。",
    response_description="资料页微信绑定轮询结果。",
)
async def poll_wechat_bind(
    ticket: str,
    user: User = Depends(get_current_user),
):
    cleanup_auth_runtime_state()
    session = await get_qr_session_state(ticket)
    if not session or str(session.get("kind") or "") != "bind":
        raise HTTPException(status_code=404, detail="绑定会话不存在")
    _assert_bind_session_owner(session, user)
    expires_at = session.get("expires_at")
    if not isinstance(expires_at, datetime) or _is_expired(expires_at):
        await delete_qr_session_state(ticket)
        return WechatBindPollResponse(status="expired", message="二维码已过期，请刷新后重试")
    status_value = str(session.get("status") or "pending")
    message = session.get("message")
    nickname = session.get("wechat_nickname")
    if status_value == "confirmed":
        await delete_qr_session_state(ticket)
    return WechatBindPollResponse(
        status=status_value,
        wechat_nickname=str(nickname).strip() if isinstance(nickname, str) and nickname.strip() else None,
        message=str(message).strip() if isinstance(message, str) and message.strip() else None,
    )


@router.delete(
    "/me/wechat",
    response_model=UserResponse,
    summary="解绑微信号",
    description="解除当前账号与已绑定微信号之间的关系，并返回最新用户信息。",
    response_description="解绑后的当前用户信息。",
)
async def unbind_wechat(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.wechat_openid:
        raise HTTPException(status_code=400, detail="当前账号未绑定微信号")

    user.wechat_openid = None
    user.wechat_nickname = None
    user.wechat_avatar_url = None
    user.wechat_bound_at = None
    await db.commit()
    await db.refresh(user)
    return await _build_user_response(user, db)


@router.delete(
    "/me",
    summary="注销账号",
    description="将当前账号标记为已注销。当前为软删除语义，注销后账户不可继续登录。",
    response_description="注销结果。",
    responses={
        200: {
            "description": "注销成功",
            "content": {
                "application/json": {
                    "example": {
                        "message": "账号已注销",
                    }
                }
            },
        }
    },
)
async def delete_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.is_active = False
    await db.commit()
    return {"message": "账号已注销"}
