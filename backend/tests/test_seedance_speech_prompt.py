from app.services.seedance_speech_prompt import build_seedance_speech_prompt


def test_build_seedance_speech_prompt_includes_role_emotion_and_requirements():
    prompt = build_seedance_speech_prompt([
        {
            "role": "小明",
            "value": "你今天怎么来了？",
            "speed": 1.2,
            "emotion": "激动",
        }
    ])
    assert "小明" in prompt
    assert "你今天怎么来了？" in prompt
    assert "情感激动" in prompt
    assert "语速1.2x" in prompt
    assert "完整念出台词" in prompt


def test_build_seedance_speech_prompt_fallback_text():
    prompt = build_seedance_speech_prompt([], fallback_text="完整旁白内容")
    assert "完整旁白内容" in prompt
