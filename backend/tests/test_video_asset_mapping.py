import asyncio

import pytest
from fastapi import HTTPException

from app.services.model_capabilities import validate_asset_bindings, validate_video_request
from app.services.video_gen import VideoGenService


@pytest.fixture(scope="module")
def video_gen_service() -> VideoGenService:
    return VideoGenService()


class TestValidateVideoRequestWithAttachments:
    def test_kling_first_frame_mode_accepts_attachment_image(self):
        result = validate_video_request(
            model="video-kling-v3",
            prompt="角色向前走",
            ratio="16:9",
            resolution="720P",
            duration=5,
            generation_mode="first_frame",
            reference_mode="first_frame",
            attachments=[
                {
                    "asset_type": "image",
                    "url": "https://example.com/key-frame.jpg",
                    "role": "reference",
                }
            ],
        )

        assert result["generation_mode"] == "first_frame"
        assert result["first_frame_url"] == "https://example.com/key-frame.jpg"

    def test_vidu_multiframe_accepts_attachment_first_frame(self):
        result = validate_video_request(
            model="video-vidu-q2",
            prompt="角色依次穿过三个场景",
            ratio="16:9",
            resolution="720P",
            duration=5,
            generation_mode="multiframe",
            attachments=[
                {
                    "asset_type": "image",
                    "url": "https://example.com/start-frame.jpg",
                    "role": "first_frame",
                }
            ],
            multiframe_segments=[
                {
                    "key_image": "https://example.com/frame-2.jpg",
                    "prompt": "进入第二个场景",
                    "duration": 2,
                },
                {
                    "key_image": "https://example.com/frame-3.jpg",
                    "prompt": "进入第三个场景",
                    "duration": 3,
                },
            ],
        )

        assert result["generation_mode"] == "multiframe"
        assert result["first_frame_url"] == "https://example.com/start-frame.jpg"

    def test_seedance_video_request_accepts_asset_ref_attachments(self):
        result = validate_video_request(
            model="doubao-seedance-2.0",
            prompt="使用真人素材生成视频",
            ratio="16:9",
            resolution="720P",
            duration=5,
            reference_mode="full",
            attachments=[
                {
                    "asset_id": "live-image-1",
                    "asset_type": "image",
                    "url": "asset://image-upstream-001",
                    "role": "reference_image",
                    "source": "live_material",
                },
                {
                    "asset_id": "live-video-1",
                    "asset_type": "video",
                    "url": "asset://video-upstream-001",
                    "role": "reference_video",
                    "source": "live_material",
                },
                {
                    "asset_id": "live-audio-1",
                    "asset_type": "audio",
                    "url": "asset://audio-upstream-001",
                    "role": "reference_audio",
                    "source": "live_material",
                },
            ],
        )

        assert result["first_frame_url"] == "asset://image-upstream-001"
        assert result["reference_video_url"] == "asset://video-upstream-001"
        assert result["reference_audio_url"] == "asset://audio-upstream-001"

    def test_seedance_mini_request_accepts_router_extra_params(self):
        result = validate_video_request(
            model="doubao-seedance-2-0-mini-260615",
            prompt="生成一个连贯镜头",
            ratio="16:9",
            resolution="720P",
            duration=5,
            reference_mode="full",
            attachments=[
                {
                    "asset_id": "live-image-1",
                    "asset_type": "image",
                    "url": "asset://image-upstream-001",
                    "role": "reference_image",
                    "source": "live_material",
                }
            ],
            multi_shot=False,
            shot_type="medium",
            multi_prompt=[{"prompt": "镜头一"}],
            provider_params={"live_material": {"enabled": True}},
        )

        assert result["model"] == "doubao-seedance-2-0-mini-260615"
        assert result["first_frame_url"] == "asset://image-upstream-001"

    def test_vidu_q3_pro_fast_rejects_text_to_video(self):
        with pytest.raises(HTTPException) as exc_info:
            validate_video_request(
                model="viduq3-pro-fast",
                prompt="一只猫在雪地里奔跑",
                ratio="16:9",
                resolution="720P",
                duration=5,
                reference_mode="first_frame",
                generation_mode="text_to_video",
            )

        assert "不支持 text_to_video 模式" in exc_info.value.detail


class TestMapAssetsToModelParams:
    def test_vidu_start_end_uses_two_generic_images(self, video_gen_service: VideoGenService):
        validated_assets = validate_asset_bindings(
            model="video-viduq3-pro",
            attachments=[
                {
                    "asset_type": "image",
                    "url": "https://example.com/first.jpg",
                    "role": "reference",
                },
                {
                    "asset_type": "image",
                    "url": "https://example.com/last.jpg",
                    "role": "reference",
                },
            ],
        )

        mapped = video_gen_service._map_assets_to_model_params(
            "video-viduq3-pro",
            validated_assets,
            generation_mode="start_end",
        )

        assert mapped["first_frame_url"] == "https://example.com/first.jpg"
        assert mapped["last_frame_url"] == "https://example.com/last.jpg"
        assert [item["role"] for item in mapped["attachments"]] == [
            "reference_image",
            "reference_image",
        ]

    def test_happyhorse_i2v_promotes_generic_image_to_first_frame(self, video_gen_service: VideoGenService):
        validated_assets = validate_asset_bindings(
            model="happyhorse-1.0-i2v",
            attachments=[
                {
                    "asset_type": "image",
                    "url": "https://example.com/reference.jpg",
                    "role": "character",
                }
            ],
        )

        mapped = video_gen_service._map_assets_to_model_params(
            "happyhorse-1.0-i2v",
            validated_assets,
        )

        assert mapped["image_url"] == "https://example.com/reference.jpg"
        assert mapped["first_frame_url"] == "https://example.com/reference.jpg"
        assert mapped["attachments"][0]["role"] == "reference_image"

    def test_seedance_mapping_preserves_live_material_asset_refs(self, video_gen_service: VideoGenService):
        validated_assets = validate_asset_bindings(
            model="doubao-seedance-2.0",
            attachments=[
                {
                    "asset_id": "live-image-1",
                    "asset_type": "image",
                    "url": "asset://image-upstream-001",
                    "role": "reference_image",
                    "source": "live_material",
                },
                {
                    "asset_id": "live-video-1",
                    "asset_type": "video",
                    "url": "asset://video-upstream-001",
                    "role": "reference_video",
                    "source": "live_material",
                },
                {
                    "asset_id": "live-audio-1",
                    "asset_type": "audio",
                    "url": "asset://audio-upstream-001",
                    "role": "reference_audio",
                    "source": "live_material",
                },
            ],
        )

        mapped = video_gen_service._map_assets_to_model_params(
            "doubao-seedance-2.0",
            validated_assets,
        )

        assert mapped["image_url"] == "asset://image-upstream-001"
        assert mapped["reference_video_url"] == "asset://video-upstream-001"
        assert mapped["reference_audio_url"] == "asset://audio-upstream-001"
        assert [item["url"] for item in mapped["attachments"]] == [
            "asset://image-upstream-001",
            "asset://video-upstream-001",
            "asset://audio-upstream-001",
        ]


class TestSeedanceAssetReferencePreparation:
    def test_prepare_external_media_url_accepts_asset_ref(self, video_gen_service: VideoGenService):
        assert video_gen_service._prepare_external_media_url(
            "asset://video-upstream-001",
            "参考视频",
        ) == "asset://video-upstream-001"

    def test_prepare_seedance_reference_media_url_accepts_asset_ref(
        self,
        video_gen_service: VideoGenService,
    ):
        prepared = asyncio.run(
            video_gen_service._prepare_seedance_reference_media_url(
                "asset://audio-upstream-001",
                "参考音频",
                media_type="audio",
            )
        )

        assert prepared == "asset://audio-upstream-001"
