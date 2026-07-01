from app.services.media_download_filenames import (
    build_download_filename,
    extract_prompt_excerpt,
    is_generic_asset_name,
    sanitize_filename_segment,
)


def test_extract_prompt_excerpt_normalizes_whitespace_and_limits_length():
    excerpt = extract_prompt_excerpt("  雨夜  赛博朋克  城市\t追逐戏  \n带霓虹反光  ")
    assert excerpt == "雨夜 赛博朋克 城市 追逐戏 带霓虹反光"


def test_sanitize_filename_segment_removes_illegal_characters():
    cleaned = sanitize_filename_segment('主体图: "夜色/角色" <测试>?*')
    assert cleaned == "主体图_ _夜色_角色_ _测试"


def test_build_download_filename_uses_prompt_when_name_is_generic():
    filename = build_download_filename(
        prefix="创作图片",
        prompt="夜色下的短发角色站在雨中",
        preferred_name="creation",
        url="/uploads/demo.png",
        asset_type="image",
    )
    assert filename == "创作图片_夜色下的短发角色站在雨中.png"


def test_build_download_filename_preserves_meaningful_name_and_extension():
    filename = build_download_filename(
        prefix="分镜视频_镜头01",
        prompt="废墟中转身回望",
        preferred_name="英雄出场",
        url="/uploads/demo-video.mp4",
        asset_type="video",
    )
    assert filename == "英雄出场_废墟中转身回望.mp4"


def test_is_generic_asset_name_recognizes_legacy_patterns():
    assert is_generic_asset_name("creation")
    assert is_generic_asset_name("分镜 #1")
    assert is_generic_asset_name("subject-image-12")
    assert not is_generic_asset_name("角色海报_夜色奔跑")
