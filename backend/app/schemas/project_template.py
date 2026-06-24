from pydantic import BaseModel, Field


class ProjectTemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    aspect_ratio: str = Field(pattern="^(16:9|9:16|1:1|4:3)$")
    visual_style: str
    visual_style_label: str | None = None
    cover_key: str = Field(min_length=1, max_length=50)
    tags: list[str] = []
    sort_order: int = 0
