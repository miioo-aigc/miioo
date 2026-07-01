"""
测试模型资产绑定能力配置和验证
"""
import pytest
from fastapi import HTTPException

from app.services.model_capabilities import (
    get_model_asset_binding_capabilities,
    get_model_capabilities,
    validate_asset_bindings,
    validate_image_request,
)


class TestGetModelAssetBindingCapabilities:
    """测试获取模型资产绑定能力"""

    def test_seedance_capabilities(self):
        """Seedance 2.0 应支持完整资产绑定"""
        caps = get_model_asset_binding_capabilities("doubao-seedance-2.0")
        model_caps = get_model_capabilities("doubao-seedance-2.0", "video")

        assert caps["reference_video"]["enabled"] is True
        assert caps["reference_video"]["max_count"] >= 1
        assert caps["reference_audio"]["enabled"] is True
        assert caps["reference_audio"]["max_count"] >= 1
        assert caps["reference_image"]["enabled"] is True
        assert caps["reference_image"]["max_count"] > 0
        assert model_caps["supports_live_material"] is True

    def test_seedance_mini_capabilities(self):
        """Seedance 2.0 Mini 应复用标准版完整资产绑定能力"""
        caps = get_model_asset_binding_capabilities("doubao-seedance-2-0-mini-260615")
        model_caps = get_model_capabilities("doubao-seedance-2-0-mini-260615", "video")

        assert caps["reference_video"]["enabled"] is True
        assert caps["reference_video"]["max_count"] >= 1
        assert caps["reference_audio"]["enabled"] is True
        assert caps["reference_audio"]["max_count"] >= 1
        assert caps["reference_image"]["enabled"] is True
        assert caps["reference_image"]["max_count"] > 0
        assert model_caps["supports_live_material"] is True

    def test_subject_reference_capabilities(self):
        """主体参考模型应支持主体参考但不支持视频/音频"""
        caps = get_model_asset_binding_capabilities("happyhorse-1.0-r2v")

        assert caps["reference_video"]["enabled"] is False
        assert caps["reference_audio"]["enabled"] is False
        assert caps["subjects"]["enabled"] is True
        assert caps["reference_image"]["max_count"] > 0

    def test_kling_capabilities(self):
        """Kling 应支持图片参考但不支持视频/音频"""
        caps = get_model_asset_binding_capabilities("video-kling-v3")

        assert caps["reference_video"]["enabled"] is False
        assert caps["reference_audio"]["enabled"] is False
        assert caps["reference_image"]["enabled"] is True
        assert caps["first_last_frame"]["enabled"] is True

    def test_vidu_q3_variants_keep_distinct_capabilities(self):
        """Vidu Q3 不同变体应返回各自能力，而不是全部折叠到 Pro"""
        pro_caps = get_model_capabilities("viduq3-pro", "video")
        turbo_caps = get_model_capabilities("viduq3-turbo", "video")
        fast_caps = get_model_capabilities("viduq3-pro-fast", "video")
        legacy_alias_caps = get_model_capabilities("video-viduq3-pro", "video")

        assert "text_to_video" in pro_caps["supported_generation_modes"]
        assert "text_to_video" in turbo_caps["supported_generation_modes"]
        assert "text_to_video" not in fast_caps["supported_generation_modes"]
        assert "first_frame" in fast_caps["supported_generation_modes"]
        assert legacy_alias_caps == pro_caps


class TestValidateAssetBindings:
    """测试资产绑定验证"""

    def test_valid_seedance_bindings(self):
        """Seedance 2.0 有效资产绑定应通过验证"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            reference_video_url="https://example.com/video.mp4",
            reference_audio_url="https://example.com/audio.mp3",
            first_frame_url="https://example.com/frame1.jpg",
        )

        assert len(result["video_refs"]) == 1
        assert len(result["audio_refs"]) == 1
        assert len(result["image_refs"]) == 1
        assert result["video_refs"][0]["url"] == "https://example.com/video.mp4"
        assert result["video_refs"][0]["role"] == "reference"

    def test_attachments_format(self):
        """统一 attachments 格式应正确解析"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            attachments=[
                {
                    "asset_id": "asset-1",
                    "asset_type": "video",
                    "url": "https://example.com/video.mp4",
                    "role": "reference",
                },
                {
                    "asset_id": "asset-2",
                    "asset_type": "image",
                    "url": "https://example.com/image.jpg",
                    "role": "character",
                },
            ],
        )

        assert len(result["video_refs"]) == 1
        assert len(result["image_refs"]) == 1
        assert result["video_refs"][0]["asset_id"] == "asset-1"
        assert result["image_refs"][0]["role"] == "character"

    def test_deduplication(self):
        """重复资产应自动去重，attachments 优先"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            reference_video_url="https://example.com/video.mp4",
            attachments=[
                {
                    "asset_type": "video",
                    "url": "https://example.com/video.mp4",  # 相同 URL
                    "role": "motion",
                },
            ],
        )

        # 应该只保留一个，且来自 attachments
        assert len(result["video_refs"]) == 1
        assert result["video_refs"][0]["role"] == "motion"
        assert result["video_refs"][0]["source"] == "attachments"

    def test_video_not_supported(self):
        """不支持视频的模型应拒绝视频资产"""
        with pytest.raises(HTTPException) as exc_info:
            validate_asset_bindings(
                model="video-kling-v3",
                reference_video_url="https://example.com/video.mp4",
            )

        assert exc_info.value.status_code == 400
        assert "不支持参考视频" in exc_info.value.detail

    def test_audio_not_supported(self):
        """不支持音频的模型应拒绝音频资产"""
        with pytest.raises(HTTPException) as exc_info:
            validate_asset_bindings(
                model="happyhorse-1.0-i2v",
                reference_audio_url="https://example.com/audio.mp3",
            )

        assert exc_info.value.status_code == 400
        assert "不支持参考音频" in exc_info.value.detail

    def test_exceed_video_limit(self):
        """超过视频数量限制应报错"""
        with pytest.raises(HTTPException) as exc_info:
            validate_asset_bindings(
                model="doubao-seedance-2.0",
                attachments=[
                    {"asset_type": "video", "url": f"https://example.com/video{i}.mp4"}
                    for i in range(10)  # 远超限制
                ],
            )

        assert exc_info.value.status_code == 400
        assert "最多支持" in exc_info.value.detail
        assert "参考视频" in exc_info.value.detail

    def test_exceed_image_limit(self):
        """超过图片数量限制应报错"""
        with pytest.raises(HTTPException) as exc_info:
            validate_asset_bindings(
                model="happyhorse-1.0-i2v",
                attachments=[
                    {"asset_type": "image", "url": f"https://example.com/img{i}.jpg"}
                    for i in range(5)
                ],
            )

        assert exc_info.value.status_code == 400
        assert "最多支持" in exc_info.value.detail
        assert "参考图片" in exc_info.value.detail

    def test_mixed_legacy_and_new_format(self):
        """混合使用旧格式和新格式应正确合并"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            reference_video_url="https://example.com/ref.mp4",
            first_frame_url="https://example.com/frame.jpg",
            attachments=[
                {
                    "asset_type": "audio",
                    "url": "https://example.com/audio.mp3",
                    "role": "background",
                },
            ],
        )

        assert len(result["video_refs"]) == 1
        assert len(result["audio_refs"]) == 1
        assert len(result["image_refs"]) == 1
        assert result["total_count"] == 3

    def test_empty_bindings(self):
        """无资产绑定应返回空列表"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
        )

        assert result["video_refs"] == []
        assert result["audio_refs"] == []
        assert result["image_refs"] == []
        assert result["total_count"] == 0

    def test_asset_id_only(self):
        """仅提供 asset_id（无 URL）应正确解析"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            reference_video_asset_id="video-123",
            first_frame_asset_id="image-456",
            reference_image_asset_ids=["image-789", "image-101"],
        )

        assert len(result["video_refs"]) == 1
        assert result["video_refs"][0]["asset_id"] == "video-123"
        assert result["video_refs"][0]["url"] is None  # URL 需要调用方解析

        assert len(result["image_refs"]) == 3  # first_frame + 2 个 reference
        asset_ids = [ref["asset_id"] for ref in result["image_refs"]]
        assert "image-456" in asset_ids
        assert "image-789" in asset_ids
        assert "image-101" in asset_ids


class TestIntegration:
    """集成测试"""

    def test_real_world_seedance_scenario(self):
        """真实场景：Seedance 2.0 完整资产绑定"""
        result = validate_asset_bindings(
            model="doubao-seedance-2.0",
            attachments=[
                {
                    "asset_id": "ref-video-001",
                    "asset_type": "video",
                    "url": "https://cdn.example.com/dance.mp4",
                    "role": "reference",
                    "asset_name": "舞蹈动作参考.mp4",
                },
                {
                    "asset_id": "char-001",
                    "asset_type": "image",
                    "url": "https://cdn.example.com/character.jpg",
                    "role": "character",
                    "asset_name": "角色参考图.jpg",
                },
            ],
            first_frame_url="https://cdn.example.com/start.jpg",
            last_frame_url="https://cdn.example.com/end.jpg",
        )

        assert result["total_count"] == 4
        assert len(result["video_refs"]) == 1
        assert len(result["image_refs"]) == 3  # character + first + last

        # 验证角色
        roles = [ref["role"] for ref in result["image_refs"]]
        assert "character" in roles
        assert "first_frame" in roles
        assert "last_frame" in roles

    def test_real_world_subject_reference_scenario(self):
        """真实场景：主体参考模型只接受图片参考，不接受视频"""
        with pytest.raises(HTTPException) as exc_info:
            validate_asset_bindings(
                model="happyhorse-1.0-r2v",
                attachments=[
                    {
                        "asset_type": "video",
                        "url": "https://example.com/video.mp4",
                    },
                ],
            )

        assert "不支持参考视频" in exc_info.value.detail

        # 正确使用方式：只传图片
        result = validate_asset_bindings(
            model="happyhorse-1.0-r2v",
            attachments=[
                {"asset_type": "image", "url": "https://example.com/char1.jpg", "role": "character"},
                {"asset_type": "image", "url": "https://example.com/char2.jpg", "role": "character"},
            ],
        )

        assert len(result["image_refs"]) == 2
        assert len(result["video_refs"]) == 0


class TestValidateImageRequest:
    def test_kling_outpainting_allows_single_reference_image(self):
        result = validate_image_request(
            model="image-kling-v3",
            size="1K",
            aspect_ratio="16:9",
            resolution="1K",
            count=1,
            reference_images=["https://example.com/input.png"],
            generation_mode="outpainting",
        )

        assert result["generation_mode"] == "outpainting"
        assert result["reference_images"] == ["https://example.com/input.png"]

    def test_kling_subject_completion_requires_reference_image(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_image_request(
                model="image-kling-v3-omni",
                size="1K",
                aspect_ratio="1:1",
                resolution="1K",
                count=1,
                reference_images=[],
                generation_mode="subject_completion",
            )

        assert exc_info.value.status_code == 400
        assert "主体补全模式至少需要 1 张主体参考图" in exc_info.value.detail
