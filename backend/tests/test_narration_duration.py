from app.services.narration_duration import (
    estimate_narration_duration_seconds,
    max_chars_for_duration,
    split_text_by_sentences,
)


def test_estimate_narration_duration_clamps_to_seedance_range():
    assert estimate_narration_duration_seconds("") is None
    assert estimate_narration_duration_seconds("短句") == 4.0
    long_text = "这是一段" * 40
    assert estimate_narration_duration_seconds(long_text) == 15.0


def test_estimate_narration_duration_respects_speed():
    text = "这是一段测试台词" * 3
    slow = estimate_narration_duration_seconds(text, speed=0.5)
    fast = estimate_narration_duration_seconds(text, speed=1.5)
    assert slow >= fast


def test_split_text_by_sentences_keeps_content():
    text = "第一句。第二句！第三句？"
    chunks = split_text_by_sentences(text, max_chars=8)
    assert "".join(chunks) == text


def test_max_chars_for_duration():
    assert max_chars_for_duration(4, speed=1.0) >= 10
