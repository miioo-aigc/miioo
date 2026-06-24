from pydantic import BaseModel, Field


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200, description="项目名称。", example="古风短剧项目")
    description: str | None = Field(default=None, description="项目描述。")
    aspect_ratio: str = Field(default="16:9", pattern="^(16:9|9:16|1:1|4:3)$", description="项目默认画幅比例。", example="16:9")
    visual_style: str = Field(max_length=50, description="视觉风格编码或标签。", example="guofeng")
    project_type: str | None = Field(None, max_length=50, description="项目类型，例如 video。", example="video")
    cover_url: str | None = Field(default=None, description="项目封面地址；支持传外链，后端会尝试落盘。")


class UpdateProjectRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200, description="项目名称。")
    description: str | None = Field(default=None, description="项目描述。")
    cover_url: str | None = Field(default=None, description="项目封面地址。")
    aspect_ratio: str | None = Field(None, pattern="^(16:9|9:16|1:1|4:3)$", description="项目画幅比例。")
    visual_style: str | None = Field(None, max_length=50, description="视觉风格编码或标签。")
    project_type: str | None = Field(None, max_length=50, description="项目类型。")
    language: str | None = Field(None, max_length=20, description="项目语言。", example="zh-CN")
    notes: str | None = Field(default=None, description="项目补充备注。")
    status: str | None = Field(default=None, description="项目状态。")


class ProjectResponse(BaseModel):
    id: str = Field(description="项目 UUID。")
    name: str = Field(description="项目名称。")
    description: str | None = Field(description="项目描述。")
    cover_url: str | None = Field(description="项目封面地址。")
    cover_thumbnail_url: str | None = Field(default=None, description="项目封面缩略图地址。")
    aspect_ratio: str = Field(description="项目画幅比例。")
    visual_style: str = Field(description="项目视觉风格编码。")
    visual_style_label: str | None = Field(default=None, description="视觉风格展示文案。")
    project_type: str | None = Field(description="项目类型。")
    language: str = Field(description="项目语言。")
    notes: str | None = Field(description="项目备注。")
    status: str = Field(description="项目状态。")
    created_at: str = Field(description="创建时间。")
    updated_at: str = Field(description="更新时间。")

    class Config:
        from_attributes = True
