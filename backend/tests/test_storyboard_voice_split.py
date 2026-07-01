from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.services.storyboard_voice_split import (
    build_voice_split_shot_payloads,
    should_split_storyboard_by_voice,
)
from uuid import uuid4


def _make_subject(name: str, voice_id: str) -> Subject:
    subject = Subject(
        id=uuid4(),
        project_id=uuid4(),
        type="character",
        name=name,
        voice_id=voice_id,
    )
    return subject


def test_should_split_storyboard_by_voice():
    segments = [
        {"role": "A", "value": "你好", "voice_id": "voice_a"},
        {"role": "B", "value": "再见", "voice_id": "voice_b"},
    ]
    assert should_split_storyboard_by_voice(segments) is True
    assert should_split_storyboard_by_voice([segments[0]]) is False


def test_build_voice_split_shot_payloads_creates_one_payload_per_voice():
    storyboard = Storyboard(
        project_id=uuid4(),
        episode_id=uuid4(),
        shot_number=1,
        content="测试镜头",
        voiceover="A：你好\nB：再见",
        character_ids=[str(uuid4()), str(uuid4())],
    )
    segments = [
        {"role": "A", "value": "你好", "voice_id": "voice_a"},
        {"role": "B", "value": "再见", "voice_id": "voice_b"},
    ]
    payloads = build_voice_split_shot_payloads(storyboard, segments=segments)
    assert len(payloads) == 2
    assert payloads[0]["voiceover"] == "A：你好"
    assert payloads[1]["voiceover"] == "B：再见"
