from pydantic import BaseModel, Field


class ProjectSettingsUpdate(BaseModel):
    script_tone: str | None = Field(None, max_length=50)
    dialogue_density: str | None = Field(None, pattern="^(low|medium|high)$")
    shot_rhythm: str | None = Field(None, pattern="^(slow|medium|fast)$")
    character_consistency: bool | None = None
    scene_consistency: bool | None = None
    output_format: str | None = Field(None, max_length=50)


class ProjectSettingsResponse(BaseModel):
    id: str
    project_id: str
    script_tone: str
    dialogue_density: str
    shot_rhythm: str
    character_consistency: bool
    scene_consistency: bool
    output_format: str

    class Config:
        from_attributes = True
