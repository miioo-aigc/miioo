from pydantic import BaseModel, Field


class CreateProviderRequest(BaseModel):
    name: str = Field(max_length=100, description="服务商显示名称。", example="OneLinkAI")
    provider_type: str = Field(max_length=50, description="服务商类型，例如 onelink / minimax / volcengine / fal。", example="onelink")
    base_url: str | None = Field(default=None, description="主凭证对应的服务商 Base URL。")
    api_key: str = Field(description="主 API Key。")
    secondary_base_url: str | None = Field(default=None, description="双凭证模式下的第二服务地址，例如火山语音地址。")
    secondary_api_key: str | None = Field(default=None, description="双凭证模式下的第二 API Key。")
    credential_mode: str | None = Field(default=None, description="凭证模式，例如 single / dual。")


class UpdateProviderRequest(BaseModel):
    name: str | None = Field(None, max_length=100, description="服务商显示名称。")
    base_url: str | None = Field(default=None, description="主服务地址。")
    api_key: str | None = Field(default=None, description="主 API Key。")
    secondary_base_url: str | None = Field(default=None, description="双凭证模式下的第二服务地址。")
    secondary_api_key: str | None = Field(default=None, description="双凭证模式下的第二 API Key。")
    credential_mode: str | None = Field(default=None, description="凭证模式。")
    is_enabled: bool | None = Field(default=None, description="是否启用该 provider。")
    default_image_watermark: bool | None = Field(default=None, description="默认图片水印开关。")
    default_video_watermark: bool | None = Field(default=None, description="默认视频水印开关。")


class ProviderResponse(BaseModel):
    id: str = Field(description="服务商 UUID。")
    name: str = Field(description="服务商显示名称。")
    provider_type: str = Field(description="服务商类型。")
    base_url: str | None = Field(description="主服务地址。")
    api_key_masked: str = Field(description="脱敏后的主 API Key。")
    secondary_base_url: str | None = Field(default=None, description="双凭证模式下的第二服务地址。")
    secondary_api_key_masked: str | None = Field(default=None, description="脱敏后的第二 API Key。")
    credential_mode: str | None = Field(default=None, description="凭证模式。")
    is_enabled: bool = Field(description="是否启用。")
    default_image_watermark: bool = Field(description="默认图片水印开关。")
    default_video_watermark: bool = Field(description="默认视频水印开关。")
    is_connected: bool = Field(description="最近一次测试是否成功。")
    last_tested_at: str | None = Field(description="最近一次测试时间。")
    created_at: str = Field(description="创建时间。")

    class Config:
        from_attributes = True


class OneClickSetupRequest(BaseModel):
    api_key: str = Field(description="内置 provider 一键配置使用的 API Key。", example="sk-xxx")


class MinimaxSetupRequest(BaseModel):
    api_key: str = Field(description="MiniMax API Key。", example="sk-xxx")
    base_url: str | None = Field(default=None, description="可选 Base URL；未传时使用官方默认地址。", example="https://api.minimaxi.com")


class VolcengineSetupRequest(BaseModel):
    ark_api_key: str = Field(description="火山引擎 Ark 模型 API Key。", example="ark-xxx")
    voice_api_key: str = Field(description="火山引擎语音能力 API Key。", example="volc-xxx")
    ark_base_url: str | None = Field(default=None, description="可选 Ark Base URL；未传时使用默认值。", example="https://ark.cn-beijing.volces.com/api/v3")
    voice_base_url: str | None = Field(default=None, description="可选语音 Base URL；未传时使用默认值。", example="https://openspeech.bytedance.com")


class PresetModelInfo(BaseModel):
    name: str = Field(description="模型展示名称。")
    model_id: str = Field(description="模型真实 ID。")
    category: str = Field(description="模型分类，例如 chat / image / video / voice。")
    description: str = Field(description="模型用途描述。")


class OneClickSetupResponse(BaseModel):
    provider: ProviderResponse = Field(description="配置完成后的 provider 信息。")
    models: list[PresetModelInfo] = Field(description="本次自动同步的预置模型列表。")
    test_success: bool = Field(description="连通性测试是否成功。")
    test_message: str = Field(description="连通性测试结果说明。")


class OneClickCleanupResponse(BaseModel):
    removed_count: int = Field(description="总清理数量。")
    removed_legacy_count: int = Field(description="清理的历史旧模型数量。")
    removed_duplicate_count: int = Field(description="清理的重复模型数量。")
    remaining_preset_count: int = Field(description="当前保留的预置模型数量。")
    message: str = Field(description="清理结果说明。")
