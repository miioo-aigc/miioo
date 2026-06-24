from pydantic import BaseModel


class CommunityQrConfigResponse(BaseModel):
    id: str | None = None
    image_url: str | None = None
    is_enabled: bool = False
    created_at: str | None = None
    updated_at: str | None = None

    class Config:
        from_attributes = True


class CommunityQrConfigUpdateRequest(BaseModel):
    image_url: str | None = None
    is_enabled: bool = True
