from uuid import uuid4

from app.models.subject import Subject
from app.services.narration_segments import (
    enrich_narration_segments,
    merge_storyboard_narration_gen_params,
    parse_voiceover_lines,
    segments_to_voiceover,
)
from app.models.storyboard import Storyboard


def test_parse_voiceover_lines_supports_half_width_colon():
    segments = parse_voiceover_lines("小明:你好\nB：再见")
    assert segments[0]["role"] == "小明"
    assert segments[0]["value"] == "你好"


def test_enrich_narration_segments_backfills_voice_id():
    subject = Subject(
        id=uuid4(),
        project_id=uuid4(),
        type="character",
        name="小明",
        voice_id="voice_1",
    )
    enriched = enrich_narration_segments(
        [{"role": "小明", "value": "你好"}],
        subjects=[subject],
        character_ids=[str(subject.id)],
    )
    assert enriched[0]["voice_id"] == "voice_1"
    assert enriched[0]["subject_id"] == str(subject.id)


def test_merge_storyboard_narration_gen_params_syncs_voiceover():
    subject = Subject(
        id=uuid4(),
        project_id=uuid4(),
        type="character",
        name="小明",
        voice_id="voice_1",
    )
    storyboard = Storyboard(
        project_id=uuid4(),
        episode_id=uuid4(),
        shot_number=1,
        character_ids=[str(subject.id)],
    )
    merged = merge_storyboard_narration_gen_params(
        {},
        {
            "narration_segments": [
                {"role": "小明", "value": "完整台词", "emotion": "中性"},
            ]
        },
        subjects=[subject],
        storyboard=storyboard,
    )
    assert merged["narration_segments"][0]["voice_id"] == "voice_1"
    assert storyboard.voiceover == "小明：完整台词"
    assert segments_to_voiceover(merged["narration_segments"]) == "小明：完整台词"
