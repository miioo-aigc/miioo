from pydantic import BaseModel, Field


class CreateUserStyleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    prompt: str = Field(..., min_length=1)
    color: str | None = None


class UpdateUserStyleRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=50)
    prompt: str | None = Field(None, min_length=1)
    color: str | None = None


class UserStyleResponse(BaseModel):
    id: str
    name: str
    prompt: str
    color: str | None
    created_at: str
    updated_at: str


class VisualStyleOptionResponse(BaseModel):
    id: str
    value: str
    label: str
    prompt: str
    color: str | None = None
    description: str | None = None
    badge: str | None = None
    is_builtin: bool
    is_custom: bool
