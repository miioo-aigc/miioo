from enum import Enum

from pydantic import BaseModel


class ApiConfigCardKey(str, Enum):
    ONELINK = "onelink"
    MINIMAX = "minimax"
    AIPING = "aiping"
    VOLCENGINE = "volcengine"
    VIDU = "vidu"
    FAL = "fal"


class ApiConfigCardVisibilityResponse(BaseModel):
    card_key: ApiConfigCardKey
    is_visible: bool = True
    updated_at: str | None = None

    class Config:
        from_attributes = True


class ApiConfigCardVisibilityUpdateRequest(BaseModel):
    is_visible: bool
