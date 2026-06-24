from typing import Any

from pydantic import BaseModel, Field


class CreateModelRequest(BaseModel):
    provider_id: str = Field(description="所属服务商 UUID。")
    name: str = Field(max_length=100, description="模型展示名称。", example="GPT-4.1")
    model_id: str = Field(max_length=200, description="真实模型 ID。", example="gpt-4.1")
    category: str = Field(pattern="^(chat|image|video|voice)$", description="模型分类。", example="chat")
    description: str | None = Field(None, max_length=500, description="模型用途描述。")
    is_enabled: bool | None = Field(default=True, description="是否启用该模型。")
    is_default: bool | None = Field(default=False, description="是否设为该分类默认模型。")


class UpdateModelRequest(BaseModel):
    is_enabled: bool | None = Field(default=None, description="是否启用该模型。")
    is_default: bool | None = Field(default=None, description="是否设为默认模型。")
    name: str | None = Field(None, max_length=100, description="模型展示名称。")
    description: str | None = Field(None, max_length=500, description="模型描述。")


class ModelConfigResponse(BaseModel):
    id: str = Field(description="模型配置 UUID。")
    provider_id: str = Field(description="所属服务商 UUID。")
    provider_type: str | None = Field(default=None, description="服务商类型。")
    provider_name: str | None = Field(default=None, description="服务商显示名称。")
    name: str = Field(description="模型展示名称。")
    model_id: str = Field(description="真实模型 ID。")
    category: str = Field(description="模型分类。")
    description: str | None = Field(description="模型描述。")
    is_enabled: bool = Field(description="是否启用。")
    is_default: bool = Field(description="是否为该分类默认模型。")
    capabilities: dict[str, Any] | None = Field(
        default=None,
        description="模型运行时能力配置，用于前端动态渲染分辨率、比例、时长等参数。",
    )
    created_at: str = Field(description="创建时间。")

    class Config:
        from_attributes = True
