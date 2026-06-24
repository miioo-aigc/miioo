from pydantic import BaseModel


class SubjectImageReferenceItem(BaseModel):
    asset_id: str | None = None
    file_url: str
    thumbnail_url: str | None = None
    preview_url: str | None = None
    large_url: str | None = None
    download_url: str | None = None
    name: str = "参考图"
    is_primary: bool = False
    created_at: str | None = None


class SubjectImageResponse(BaseModel):
    id: str
    subject_id: str
    image_url: str
    thumbnail_url: str | None = None
    preview_url: str | None = None
    large_url: str | None = None
    download_url: str | None = None
    preview_ready: bool | None = None
    asset_id: str | None = None
    is_primary: bool
    prompt: str | None
    model: str | None
    size: str | None
    input_prompt: str | None = None
    ratio: str | None = None
    resolution: str | None = None
    generation_mode: str | None = None
    reference_mode: str | None = None
    reference_images: list[SubjectImageReferenceItem] = []
    created_at: str

    class Config:
        from_attributes = True
