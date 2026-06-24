from typing import Any

from pydantic import BaseModel, Field


class AssetCreate(BaseModel):
    project_id: str | None = Field(default=None, description="所属项目 UUID。")
    subject_id: str | None = Field(default=None, description="可选关联主体 UUID。")
    name: str = Field(min_length=1, max_length=200, description="资产名称。", example="主角定版图")
    asset_type: str = Field(pattern="^(image|video|audio|document)$", description="资产类型。", example="image")
    category: str = Field(pattern="^(character|scene|prop|storyboard|audio|film|document|reference|bgm|voiceover|other)$", description="业务分类。", example="character")
    file_url: str = Field(min_length=1, max_length=500, description="资产文件地址；支持外链，后端会尝试托管。")
    thumbnail_url: str | None = Field(default=None, description="缩略图地址。")
    prompt: str | None = Field(default=None, description="生成该资产时使用的提示词。")
    model: str | None = Field(default=None, description="生成该资产时使用的模型。")
    size: str | None = Field(default=None, description="分辨率或尺寸描述。", example="1024x1024")
    is_primary: bool = Field(default=False, description="是否为主图或主资产。")
    is_starred: bool = Field(default=False, description="是否已收藏。")
    metadata_json: dict | None = Field(default=None, description="扩展元数据。")
    description: str | None = Field(default=None, description="资产描述。")
    reference_image_urls: list[str] | None = Field(default=None, description="关联参考图地址列表。")


class AssetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200, description="资产名称。")
    is_primary: bool | None = Field(default=None, description="是否为主资产。")
    is_starred: bool | None = Field(default=None, description="是否收藏。")
    category: str | None = Field(default=None, description="资产分类。")
    metadata_json: dict | None = Field(default=None, description="追加或更新的元数据。")
    subject_id: str | None = Field(default=None, description="新的主体 UUID 绑定。")
    description: str | None = Field(default=None, description="资产描述。")
    reference_image_urls: list[str] | None = Field(default=None, description="参考图地址列表。")


class AssetResponse(BaseModel):
    id: str = Field(description="资产 UUID。")
    user_id: str = Field(description="所属用户 UUID。")
    project_id: str | None = Field(description="所属项目 UUID。")
    subject_id: str | None = Field(description="关联主体 UUID。")
    name: str = Field(description="资产名称。")
    asset_type: str = Field(description="资产类型。")
    category: str = Field(description="资产分类。")
    file_url: str = Field(description="资产文件地址。")
    thumbnail_url: str | None = Field(description="缩略图地址。")
    preview_url: str | None = Field(default=None, description="预览地址。")
    previewUrl: str | None = Field(default=None, description="预览地址（camelCase）。")
    large_url: str | None = Field(default=None, description="大图预览地址。")
    largeUrl: str | None = Field(default=None, description="大图预览地址（camelCase）。")
    download_url: str | None = Field(default=None, description="下载地址。")
    downloadUrl: str | None = Field(default=None, description="下载地址（camelCase）。")
    poster_url: str | None = Field(default=None, description="视频海报地址。")
    posterUrl: str | None = Field(default=None, description="视频海报地址（camelCase）。")
    preview_video_url: str | None = Field(default=None, description="视频预览地址。")
    previewVideoUrl: str | None = Field(default=None, description="视频预览地址（camelCase）。")
    hls_url: str | None = Field(default=None, description="HLS 主播放地址。")
    hlsUrl: str | None = Field(default=None, description="HLS 主播放地址（camelCase）。")
    available_qualities: list[dict[str, Any]] | None = Field(default=None, description="视频可用清晰度列表。")
    availableQualities: list[dict[str, Any]] | None = Field(default=None, description="视频可用清晰度列表（camelCase）。")
    preview_ready: bool | None = Field(default=None, description="预览是否就绪。")
    previewReady: bool | None = Field(default=None, description="预览是否就绪（camelCase）。")
    prompt: str | None = Field(description="提示词。")
    model: str | None = Field(description="生成模型。")
    size: str | None = Field(description="尺寸或分辨率。")
    is_primary: bool = Field(description="是否为主资产。")
    is_starred: bool = Field(description="是否已收藏。")
    metadata_json: dict | None = Field(default=None, description="扩展元数据。")
    description: str | None = Field(default=None, description="资产描述。")
    reference_image_urls: list[str] | None = Field(default=None, description="参考图地址列表。")
    episode_label: str | None = Field(default=None, description="所属分集文案。")
    episodeLabel: str | None = Field(default=None, description="所属分集文案（camelCase）。")
    is_deleted: bool = Field(default=False, description="是否已移入回收站。")
    deleted_at: str | None = Field(default=None, description="移入回收站时间。")
    created_at: str = Field(description="创建时间。")

    class Config:
        from_attributes = True
