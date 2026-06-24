import pytest

from app.services.video_gen import VideoGenService


@pytest.fixture(scope="module")
def video_gen_service() -> VideoGenService:
    return VideoGenService()


def test_extract_video_task_payload_handles_camel_case_result_fields(
    video_gen_service: VideoGenService,
):
    payload = {
        "taskId": "task-camel-1",
        "taskStatus": "SUCCEEDED",
        "videoUrl": "https://cdn.example.com/generated/video.mp4",
        "thumbnailUrl": "https://cdn.example.com/generated/video-cover.jpg",
    }

    parsed = video_gen_service._extract_video_task_payload(payload)

    assert parsed["task_id"] == "task-camel-1"
    assert parsed["status"] == "succeeded"
    assert parsed["url"] == "https://cdn.example.com/generated/video.mp4"
    assert parsed["thumbnail_url"] == "https://cdn.example.com/generated/video-cover.jpg"


def test_extract_video_task_payload_prefers_nested_camel_case_video_result(
    video_gen_service: VideoGenService,
):
    payload = {
        "data": {
            "status": "succeeded",
            "content": [
                {
                    "type": "video",
                    "thumbnailUrl": "https://cdn.example.com/generated/thumb.jpg",
                    "videoUrl": "https://cdn.example.com/generated/final.mp4",
                }
            ],
        }
    }

    parsed = video_gen_service._extract_video_task_payload(payload)

    assert parsed["status"] == "succeeded"
    assert parsed["url"] == "https://cdn.example.com/generated/final.mp4"
    assert parsed["thumbnail_url"] == "https://cdn.example.com/generated/thumb.jpg"


def test_extract_video_task_payload_preserves_playback_fields(
    video_gen_service: VideoGenService,
):
    payload = {
        "task_id": "task-hls-1",
        "status": "SUCCEEDED",
        "output": {
            "video_url": "https://cdn.example.com/generated/final.mp4",
            "preview_video_url": "https://cdn.example.com/generated/preview.mp4",
            "hls_master_playlist": "https://cdn.example.com/generated/master.m3u8",
            "available_qualities": [
                {"id": "540p", "label": "540p", "default": True},
                {"id": "720p", "label": "720p", "default": False},
            ],
        },
    }

    parsed = video_gen_service._extract_video_task_payload(payload)

    assert parsed["task_id"] == "task-hls-1"
    assert parsed["url"] == "https://cdn.example.com/generated/final.mp4"
    assert parsed["preview_video_url"] == "https://cdn.example.com/generated/preview.mp4"
    assert parsed["hls_url"] == "https://cdn.example.com/generated/master.m3u8"
    assert parsed["hls_master_playlist"] == "https://cdn.example.com/generated/master.m3u8"
    assert parsed["available_qualities"] == [
        {"id": "540p", "label": "540p", "default": True},
        {"id": "720p", "label": "720p", "default": False},
    ]


def test_build_video_generation_result_merges_upstream_playback_fields(
    video_gen_service: VideoGenService,
):
    result = video_gen_service._build_video_generation_result(
        url="https://cdn.example.com/generated/final.mp4",
        thumbnail_url="https://cdn.example.com/generated/thumb.jpg",
        task_id="task-build-1",
        sources=[
            {
                "previewVideoUrl": "https://cdn.example.com/generated/preview.mp4",
                "hlsUrl": "https://cdn.example.com/generated/master.m3u8",
                "availableQualities": [
                    {"id": "1080p", "label": "1080p", "default": True},
                ],
            }
        ],
    )

    assert result["url"] == "https://cdn.example.com/generated/final.mp4"
    assert result["task_id"] == "task-build-1"
    assert result["preview_video_url"] == "https://cdn.example.com/generated/preview.mp4"
    assert result["hls_url"] == "https://cdn.example.com/generated/master.m3u8"
    assert result["available_qualities"] == [
        {"id": "1080p", "label": "1080p", "default": True},
    ]
