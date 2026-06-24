import json

from app.services.video_gen import VideoGenService


def test_format_seedance_submit_error_for_reference_audio_duration_limit():
    service = VideoGenService()
    inner_payload = {
        "error": {
            "code": "InvalidParameter",
            "param": "content[2]",
            "message": (
                "The parameter `content[2]` specified in the request is not valid: "
                "the parameter audio duration (seconds) specified in the request must be "
                "less than or equal to 15.2 for model doubao-seedance-2-0 in r2v. "
                "Request id: 021782216678145a7f4d4af3e382e8c5fe721af27b2ecdf5b091d"
            ),
        }
    }
    response_text = json.dumps(
        {
            "error": {
                "message": json.dumps(inner_payload, ensure_ascii=False),
            }
        },
        ensure_ascii=False,
    )

    message = service._format_seedance_submit_error(
        response_text=response_text,
        model="doubao-seedance-2.0",
        asset_bindings=[
            {"asset_type": "video", "asset_name": "参考视频", "url": "https://example.com/video.mp4"},
            {"asset_type": "audio", "asset_name": "参考音频", "url": "https://example.com/audio.mp3"},
        ],
    )

    assert "参考音频" in message
    assert "15.2" in message
    assert "15 秒内" in message
    assert "content[2]" in message
    assert "021782216678145a7f4d4af3e382e8c5fe721af27b2ecdf5b091d" in message
