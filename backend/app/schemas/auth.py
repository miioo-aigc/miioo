from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11, description="11 位中国大陆手机号。", example="13800000000")
    password: str = Field(min_length=6, description="登录密码，最少 6 位。", example="123456")


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11, description="11 位中国大陆手机号。", example="13800000000")
    password: str = Field(min_length=6, description="注册密码，最少 6 位。", example="123456")
    nickname: str | None = Field(
        default=None,
        max_length=50,
        description="昵称，可选；未传时默认使用手机号。",
        example="阿星",
    )


class SendCodeRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11, description="接收验证码的手机号。", example="13800000000")


class VerifyCodeLoginRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11, description="接收验证码的手机号。", example="13800000000")
    code: str = Field(min_length=4, max_length=6, description="短信验证码或开发态调试验证码。", example="666666")


class TokenResponse(BaseModel):
    access_token: str = Field(description="访问业务接口使用的 access token。")
    refresh_token: str = Field(description="用于刷新登录态的 refresh token。")
    token_type: str = Field(default="bearer", description="固定为 bearer。", example="bearer")


class RefreshRequest(BaseModel):
    refresh_token: str = Field(description="刷新登录态使用的 refresh token。")


class SendCodeResponse(BaseModel):
    success: bool = Field(default=True, description="是否成功进入验证码发送流程。")
    message: str = Field(default="验证码已发送", description="发送结果提示。")
    expires_in: int = Field(default=300, description="验证码有效期，单位秒。", example=300)
    debug_code: str | None = Field(default=None, description="仅开发态开启时返回，正式环境通常为空。", example="666666")


class QrCodeSessionResponse(BaseModel):
    session_id: str = Field(description="扫码登录会话 ID。")
    qr_code_value: str = Field(description="当前二维码内容。")
    expires_in: int = Field(default=180, description="二维码有效期，单位秒。")
    status: str = Field(default="pending", description="扫码会话状态。", example="pending")


class QrCodePollResponse(BaseModel):
    status: str = Field(
        description="扫码会话状态。常见值：pending / scanned / need_bind_mobile / confirmed / expired / error。",
        example="pending",
    )
    access_token: str | None = Field(default=None, description="当状态为 confirmed 时返回。")
    refresh_token: str | None = Field(default=None, description="当状态为 confirmed 时返回。")
    bind_token: str | None = Field(default=None, description="当状态为 need_bind_mobile 时返回，用于继续绑定手机号。")
    message: str | None = Field(default=None, description="扫码链路中的补充提示信息。")
    token_type: str = Field(default="bearer", description="固定为 bearer。")


class QrCodeConfirmRequest(BaseModel):
    session_id: str = Field(description="待确认的扫码登录会话 ID。")
    phone: str = Field(min_length=11, max_length=11, description="绑定到本次微信扫码登录的手机号。", example="13800000000")
    code: str | None = Field(
        default=None,
        min_length=4,
        max_length=6,
        description="手机号验证码。兼容旧调用方可传 code。",
        example="666666",
    )
    sms_code: str | None = Field(
        default=None,
        min_length=4,
        max_length=6,
        description="手机号验证码。前端当前绑定流程使用 sms_code 字段。",
        example="666666",
    )
    nickname: str | None = Field(default=None, max_length=50, description="首次创建账号时写入的昵称。", example="微信用户")


class WechatCallbackCompleteRequest(BaseModel):
    code: str = Field(description="微信开放平台授权后回调的 code。")
    state: str = Field(description="二维码会话 state。")


class WechatCallbackCompleteResponse(BaseModel):
    success: bool = Field(default=True, description="回调处理是否成功。")
    status: str = Field(
        description="回调处理后的会话状态。常见值：scanned / need_bind_mobile / confirmed。",
        example="confirmed",
    )
    message: str = Field(description="给手机端回调页展示的结果文案。")


class UserResponse(BaseModel):
    id: str = Field(description="用户 UUID。")
    display_id: str | None = Field(default=None, description="前端展示用账号 ID，例如 miioo_123456。")
    phone: str = Field(description="脱敏后的手机号。")
    phone_bound: bool = Field(default=True, description="是否已绑定手机号。")
    nickname: str = Field(description="用户昵称。")
    avatar_url: str | None = Field(default=None, description="头像 URL，可为空。")
    wechat: str | None = Field(default=None, description="微信展示名；未绑定时为空。")
    wechat_nickname: str | None = Field(default=None, description="原始微信昵称；未绑定时为空。")
    wechat_bound: bool = Field(default=False, description="是否已绑定微信。")
    has_api_configured: bool = Field(default=False, description="当前用户是否至少配置了一个可用 provider。")
    is_admin: bool = Field(default=False, description="是否为管理员账号。")

    class Config:
        from_attributes = True
