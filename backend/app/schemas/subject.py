from pydantic import BaseModel, Field

from app.schemas.subject_image import SubjectImageResponse


class SubjectCreate(BaseModel):
    type: str = Field(pattern="^(character|scene|prop)$")
    name: str = Field(min_length=1, max_length=100)
    role: str | None = Field(None, max_length=50)
    description: str | None = None
    appearance: str | None = None
    personality: str | None = None
    prompt: str | None = None
    episode_id: str | None = None
    is_global: bool = False
    # 角色
    age: str | None = None
    gender: str | None = None
    background: str | None = None
    # 场景
    scene_type: str | None = None
    time_setting: str | None = None
    atmosphere: str | None = None
    # 道具
    importance: str | None = None
    owner_subject_id: str | None = None
    voice_id: str | None = None
    reference_image_url: str | None = None
    reference_asset_id: str | None = None
    gen_config: dict | None = None


class SubjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    role: str | None = None
    description: str | None = None
    appearance: str | None = None
    personality: str | None = None
    prompt: str | None = None
    image_url: str | None = None
    is_global: bool | None = None
    age: str | None = None
    gender: str | None = None
    background: str | None = None
    scene_type: str | None = None
    time_setting: str | None = None
    atmosphere: str | None = None
    importance: str | None = None
    owner_subject_id: str | None = None
    voice_id: str | None = None
    reference_image_url: str | None = None
    reference_asset_id: str | None = None
    gen_config: dict | None = None


class SubjectFieldExtractRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=1000)


class SubjectFieldExtractResponse(BaseModel):
    type: str
    role: str | None = None
    appearance: str | None = None
    personality: str | None = None
    age: str | None = None
    gender: str | None = None
    background: str | None = None
    scene_type: str | None = None
    time_setting: str | None = None
    atmosphere: str | None = None
    importance: str | None = None
    prompt: str | None = None


class SubjectResponse(BaseModel):
    id: str
    project_id: str
    episode_id: str | None
    type: str
    name: str
    role: str | None
    description: str | None
    appearance: str | None
    personality: str | None
    prompt: str | None
    image_url: str | None
    thumbnail_url: str | None = None
    preview_url: str | None = None
    large_url: str | None = None
    download_url: str | None = None
    preview_ready: bool | None = None
    is_global: bool
    age: str | None = None
    gender: str | None = None
    background: str | None = None
    scene_type: str | None = None
    time_setting: str | None = None
    atmosphere: str | None = None
    importance: str | None = None
    owner_subject_id: str | None = None
    voice_id: str | None = None
    reference_image_url: str | None = None
    reference_asset_id: str | None = None
    gen_config: dict | None = None
    primary_image_url: str | None = None
    image_count: int = 0
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class SubjectListResponse(BaseModel):
    list: list[SubjectResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    hasMore: bool


class SubjectReferenceImage(BaseModel):
    asset_id: str
    file_url: str
    thumbnail_url: str | None = None
    preview_url: str | None = None
    large_url: str | None = None
    download_url: str | None = None
    name: str
    is_primary: bool = False
    created_at: str | None = None


class SubjectGenerateConfig(BaseModel):
    input_prompt: str | None = None
    prompt: str | None = None
    model: str | None = None
    size: str | None = None
    watermark: bool | None = None
    ratio: str | None = None
    resolution: str | None = None
    generation_mode: str | None = None
    reference_mode: str | None = None


class SubjectDetailResponse(BaseModel):
    subject: SubjectResponse
    primary_image: SubjectImageResponse | None = None
    candidate_images: list[SubjectImageResponse] = []
    reference_images: list[SubjectReferenceImage] = []
    latest_generate_config: SubjectGenerateConfig | None = None
