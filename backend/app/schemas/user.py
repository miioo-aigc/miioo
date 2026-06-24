from typing import List

from pydantic import BaseModel, Field


class UpdateUserRequest(BaseModel):
    nickname: str | None = Field(None, max_length=50)
    avatar_url: str | None = None


class SendPhoneRebindCodeRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11)


class ConfirmPhoneRebindRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=11)
    code: str = Field(min_length=4, max_length=6)


class BindWechatRequest(BaseModel):
    wechat_id: str = Field(min_length=2, max_length=50)
    wechat_nickname: str | None = Field(default=None, max_length=50)
    wechat_avatar_url: str | None = None


class WechatBindQrCodeResponse(BaseModel):
    ticket: str
    qr_code_value: str
    expires_in: int
    status: str = "pending"


class WechatBindPollResponse(BaseModel):
    status: str
    wechat_nickname: str | None = None
    message: str | None = None


class AdminUserAccountItem(BaseModel):
    id: str
    display_id: str | None = None
    nickname: str
    current_phone: str
    registered_phone: str | None = None
    last_login_phone: str | None = None
    last_login_at: str | None = None
    is_admin: bool = False
    is_active: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class AdminUserAccountUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, min_length=11, max_length=11)
    is_admin: bool | None = None
    is_active: bool | None = None


class AdminUserAccountListResponse(BaseModel):
    list: List[AdminUserAccountItem]
    total: int
    page: int
    page_size: int
    has_more: bool
