from pydantic import BaseModel, Field


class TTSStreamOptions(BaseModel):
    exclude_aggregated_audio: bool | None = None


class TTSVoiceSetting(BaseModel):
    voice_id: str | None = None
    speed: float | None = Field(default=None, ge=0.5, le=2.0)
    vol: float | None = Field(default=None, gt=0.0, le=10.0)
    pitch: int | None = Field(default=None, ge=-12, le=12)
    emotion: str | None = None
    text_normalization: bool | None = None
    latex_read: bool | None = None


class TTSAudioSetting(BaseModel):
    sample_rate: int | None = None
    bitrate: int | None = None
    format: str | None = None
    channel: int | None = Field(default=None, ge=1, le=2)
    force_cbr: bool | None = None


class TTSPronunciationDict(BaseModel):
    tone: list[str] | None = None


class TTSTimbreWeight(BaseModel):
    voice_id: str
    weight: int = Field(ge=1, le=100)


class TTSVoiceModify(BaseModel):
    pitch: int | None = Field(default=None, ge=-100, le=100)
    intensity: int | None = Field(default=None, ge=-100, le=100)
    timbre: int | None = Field(default=None, ge=-100, le=100)
    sound_effects: str | None = None


class TTSAdvancedOptionsMixin(BaseModel):
    voice_setting: TTSVoiceSetting | None = None
    audio_setting: TTSAudioSetting | None = None
    pronunciation_dict: TTSPronunciationDict | None = None
    timbre_weights: list[TTSTimbreWeight] | None = None
    language_boost: str | None = None
    voice_modify: TTSVoiceModify | None = None
    subtitle_enable: bool | None = None
    subtitle_type: str | None = None
    output_format: str | None = None
    aigc_watermark: bool | None = None
    stream: bool | None = None
    stream_options: TTSStreamOptions | None = None


def build_tts_provider_options(
    request_model: object,
    *,
    default_voice_id: str,
    default_speed: float,
    default_emotion: str | None,
) -> dict | None:
    voice_setting_model = getattr(request_model, "voice_setting", None)
    voice_setting_payload = voice_setting_model.model_dump(exclude_none=True) if voice_setting_model else {}
    if not voice_setting_payload.get("voice_id"):
        voice_setting_payload["voice_id"] = default_voice_id
    if voice_setting_payload.get("speed") is None:
        voice_setting_payload["speed"] = default_speed
    if voice_setting_payload.get("emotion") is None and default_emotion:
        voice_setting_payload["emotion"] = default_emotion

    options: dict[str, object] = {
        "voice_setting": voice_setting_payload,
    }

    for field_name in (
        "audio_setting",
        "pronunciation_dict",
        "language_boost",
        "voice_modify",
        "subtitle_enable",
        "subtitle_type",
        "output_format",
        "aigc_watermark",
        "stream",
        "stream_options",
    ):
        value = getattr(request_model, field_name, None)
        if value is None:
            continue
        options[field_name] = (
            value.model_dump(exclude_none=True) if hasattr(value, "model_dump") else value
        )

    timbre_weights = getattr(request_model, "timbre_weights", None)
    if timbre_weights:
        options["timbre_weights"] = [
            item.model_dump(exclude_none=True) if hasattr(item, "model_dump") else item
            for item in timbre_weights
        ]

    if len(options) == 1 and options["voice_setting"] == {
        "voice_id": default_voice_id,
        "speed": default_speed,
        **({"emotion": default_emotion} if default_emotion else {}),
    }:
        return None
    return options
