from pydantic import BaseModel, Field


class ReferenceAudioLibraryItemResponse(BaseModel):
    id: str = Field(description="参考音频 UUID。")
    name: str = Field(description="参考音频名称。")
    description: str | None = Field(default=None, description="参考音频描述。")
    audio_url: str = Field(description="参考音频原始文件 URL。")
    preview_url: str | None = Field(default=None, description="预览播放 URL；当前通常与 audio_url 相同。")
    gender: str | None = Field(default=None, description="适用性别标签。")
    age_group: str | None = Field(default=None, description="适用年龄段标签。")
    language: str | None = Field(default=None, description="语言标签。")
    emotion: str | None = Field(default=None, description="情绪标签。")
    tags: list[str] = Field(default_factory=list, description="自定义标签列表。")
    is_enabled: bool = Field(default=True, description="是否启用。")
    sort_order: int = Field(default=0, description="排序值，越小越靠前。")
    created_at: str | None = Field(default=None, description="创建时间。")
    updated_at: str | None = Field(default=None, description="更新时间。")


class ReferenceAudioLibraryListResponse(BaseModel):
    items: list[ReferenceAudioLibraryItemResponse] = Field(description="参考音频列表。")
