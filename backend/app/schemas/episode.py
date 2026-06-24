from pydantic import BaseModel, Field


class EpisodeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200, description="分集标题。", example="第1集")
    episode_number: int = Field(ge=1, description="分集序号。", example=1)
    content: str | None = Field(default=None, description="分集剧本正文。")
    summary: str | None = Field(default=None, description="分集摘要。")


class EpisodeUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200, description="分集标题。")
    content: str | None = Field(default=None, description="分集剧本正文。")
    summary: str | None = Field(default=None, description="分集摘要。")
    status: str | None = Field(None, pattern="^(draft|scripted|extracted|storyboarded)$", description="分集状态。")


class EpisodeResponse(BaseModel):
    id: str = Field(description="分集 UUID。")
    project_id: str = Field(description="所属项目 UUID。")
    title: str = Field(description="分集标题。")
    episode_number: int = Field(description="分集序号。")
    content: str | None = Field(description="分集剧本正文。")
    summary: str | None = Field(description="分集摘要。")
    status: str = Field(description="分集状态。")
    created_at: str = Field(description="创建时间。")
    updated_at: str = Field(description="更新时间。")

    class Config:
        from_attributes = True
