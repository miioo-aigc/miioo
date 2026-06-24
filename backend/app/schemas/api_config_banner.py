from pydantic import BaseModel


class ApiConfigBannerResponse(BaseModel):
    id: str | None = None
    image_url: str | None = None
    is_enabled: bool = False
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class ApiConfigBannerUpdateRequest(BaseModel):
    image_url: str | None = None
    is_enabled: bool = True
