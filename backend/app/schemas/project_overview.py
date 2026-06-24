from pydantic import BaseModel, Field


class AssetCounts(BaseModel):
    character: int = Field(default=0, description="项目下角色主体数量。")
    prop: int = Field(default=0, description="项目下道具主体数量。")
    scene: int = Field(default=0, description="项目下场景主体数量。")
    storyboard: int = Field(default=0, description="项目下分镜总数。")
    image: int = Field(default=0, description="项目资产域内图片数量。")
    video: int = Field(default=0, description="项目资产域内视频数量。")


class StoryboardThumbnail(BaseModel):
    id: str = Field(description="分镜 UUID。")
    image_url: str = Field(description="分镜缩略图或主图地址。")
    shot_number: int = Field(description="镜头编号。")


class StoryboardOperationRecord(BaseModel):
    storyboard_id: str = Field(description="分镜 UUID。")
    shot_number: int = Field(description="镜头编号。")
    action: str = Field(description="操作类型编码，例如 create / edit / generate_image / generate_video。")
    action_label: str = Field(description="操作类型展示文案。")
    occurred_at: str = Field(description="操作发生时间。")
    description: str = Field(description="供前端直接展示的操作说明。")


class EpisodeProgress(BaseModel):
    episode_id: str = Field(description="分集 UUID。")
    title: str = Field(description="分集标题。")
    episode_number: int = Field(description="分集序号。")
    storyboard_count: int = Field(description="该分集下分镜总数。")
    image_generated_count: int = Field(description="已生成图片的分镜数量。")
    video_generated_count: int = Field(description="已生成视频的分镜数量。")
    thumbnail_url: str | None = Field(default=None, description="该分集概览缩略图。")
    status: str = Field(description="分集进度状态，例如 no_storyboard / no_image / images_ready / videos_ready / edited。")
    operation_history: list[StoryboardOperationRecord] = Field(default_factory=list, description="最近几条分镜相关操作记录。")


class ProjectOverviewResponse(BaseModel):
    asset_counts: AssetCounts = Field(description="项目内主体、分镜和媒体资源的数量统计。")
    storyboard_thumbnails: list[StoryboardThumbnail] = Field(description="项目首页可直接展示的分镜缩略图列表。")
    episode_progress: list[EpisodeProgress] = Field(description="各分集的分镜进度概览。")
