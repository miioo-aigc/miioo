import pytest

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
