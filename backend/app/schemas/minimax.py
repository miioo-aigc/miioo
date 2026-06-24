from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.tts import TTSAdvancedOptionsMixin


class MinimaxT2ARequest(TTSAdvancedOptionsMixin):
    model: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=10000)


class MinimaxT2AResponse(BaseModel):
    url: str
    duration: float
    metadata: dict[str, Any] | None = None
    raw_payload: dict[str, Any] | None = None


class MinimaxAsyncT2ARequest(TTSAdvancedOptionsMixin):
    model: str = Field(min_length=1, max_length=100)
    text: str | None = Field(default=None, max_length=50000)
    text_file_id: int | None = None

    @model_validator(mode="after")
    def validate_text_source(self):
        if not self.text and self.text_file_id is None:
            raise ValueError("text 和 text_file_id 至少需要提供一个")
        return self


class MinimaxAsyncTaskCreateResponse(BaseModel):
    task_id: str
    task_token: str | None = None
    file_id: str | None = None
    raw_payload: dict[str, Any] | None = None


class MinimaxAsyncTaskQueryResponse(BaseModel):
    status: str
    audio_url: str | None = None
    file_id: str | None = None
    task_token: str | None = None
    trace_id: str | None = None
    raw_payload: dict[str, Any] | None = None


class MinimaxFileUploadResponse(BaseModel):
    file_id: str
    raw_payload: dict[str, Any] | None = None


class MinimaxVoiceClonePrompt(BaseModel):
    prompt_audio: int
    prompt_text: str = Field(min_length=1, max_length=500)


class MinimaxVoiceCloneRequest(BaseModel):
    file_id: int
    voice_id: str = Field(min_length=8, max_length=256)
    clone_prompt: MinimaxVoiceClonePrompt | None = None
    text: str | None = Field(default=None, max_length=1000)
    model: str | None = Field(default=None, max_length=100)
    language_boost: str | None = None
    need_noise_reduction: bool | None = False
    need_volume_normalization: bool | None = False
    aigc_watermark: bool | None = False


class MinimaxVoiceCloneResponse(BaseModel):
    voice_id: str
    preview_url: str | None = None
    expires_at: str | None = None
    trace_id: str | None = None
    raw_payload: dict[str, Any] | None = None


class MinimaxVoiceDesignRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    preview_text: str = Field(min_length=1, max_length=500)
    voice_id: str | None = Field(default=None, max_length=256)
    aigc_watermark: bool | None = False


class MinimaxVoiceDesignResponse(BaseModel):
    voice_id: str
    trial_audio_url: str | None = None
    raw_payload: dict[str, Any] | None = None


class MinimaxVoiceQueryRequest(BaseModel):
    voice_type: Literal["system", "voice_cloning", "voice_generation", "all"]


class MinimaxVoiceQueryItem(BaseModel):
    voice_id: str
    name: str
    description: list[str] = []
    created_time: str | None = None
    voice_type: str
    provider: str
    is_custom: bool
    source_label: str | None = None


class MinimaxVoiceQueryResponse(BaseModel):
    voices: list[MinimaxVoiceQueryItem]
    raw_payload: dict[str, Any] | None = None
