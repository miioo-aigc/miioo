from typing import List

from pydantic import BaseModel, Field


class AdminModelVisibilityResponse(BaseModel):
    provider_type: str = Field(description="服务商类型，例如 onelink / minimax / volcengine。")
    provider_name: str = Field(description="服务商展示名称。")
    model_id: str = Field(description="模型真实 ID。")
    name: str = Field(description="模型展示名称。")
    category: str = Field(description="模型分类，例如 chat / image / video / voice。")
    is_visible: bool = Field(description="是否对普通用户开放。")
    updated_at: str | None = Field(default=None, description="最近更新时间。")

    class Config:
        from_attributes = True


class AdminModelVisibilityUpdateRequest(BaseModel):
    is_visible: bool = Field(description="是否对普通用户开放。")


class AdminModelVisibilityListResponse(BaseModel):
    list: List[AdminModelVisibilityResponse] = Field(description="当前页模型开放配置列表。")
    total: int = Field(description="总条数。")
    visible_total: int = Field(description="当前筛选条件下开放中的模型总数。")
    page: int = Field(description="当前页码。")
    page_size: int = Field(description="每页数量。")
    has_more: bool = Field(description="是否还有下一页。")
