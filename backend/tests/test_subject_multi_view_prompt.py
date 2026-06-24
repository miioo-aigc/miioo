from types import SimpleNamespace

from app.routers.subjects import (
    _build_character_three_view_prompt,
    _build_subject_style_suffix,
    _resolve_subject_generation_prompt,
)


def _build_character_subject():
    return SimpleNamespace(
        type="character",
        name="玄甲将军",
        gender="male",
        age="35",
        personality="沉稳威严",
        background="古战场名将",
        description="身披重甲，手持长枪",
        appearance="高大挺拔，面容粗犷",
    )


def test_character_three_view_prompt_upgrades_to_four_fixed_views():
    subject = _build_character_subject()

    prompt = _build_character_three_view_prompt(subject, "一位身穿古代战甲的角色设定图")

    assert "4 fixed panels" in prompt
    assert "face close-up portrait" in prompt
    assert "Front Full Body view" in prompt
    assert "Side Full Body view" in prompt
    assert "Back Full Body view" in prompt
    assert "all four views" in prompt
    assert "3 equal panels" not in prompt
    assert "all 3 panels" not in prompt
    assert "three-panel turnaround sheet" not in prompt


def test_character_three_view_style_suffix_matches_four_view_semantics():
    subject = _build_character_subject()

    suffixes = _build_subject_style_suffix(subject, "three_view")

    assert suffixes == [
        "single character multi-view reference sheet",
        "face close-up plus front full body, side full body, and back full body views",
        "consistent identity across all four views",
    ]


def test_single_mode_prompt_does_not_switch_to_multi_view_sheet():
    subject = _build_character_subject()

    prompt = _resolve_subject_generation_prompt(subject, "电影感角色海报", "single")

    assert "4 fixed panels" not in prompt
    assert "face close-up portrait" not in prompt
    assert "电影感角色海报" in prompt
