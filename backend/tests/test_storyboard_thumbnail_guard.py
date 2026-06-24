import uuid
from datetime import datetime, timezone

from app.models.storyboard import Storyboard
from app.routers.storyboards import _to_response
from app.utils.media_urls import pick_safe_thumbnail_url


def test_pick_safe_thumbnail_url_skips_video_and_audio_candidates():
    resolved = pick_safe_thumbnail_url(
        "/uploads/storyboards/video-thumbnails/demo.mp4",
        "/uploads/storyboards/audio/demo.mp3",
        "/uploads/storyboards/demo-image.png",
    )

    assert resolved == "/uploads/storyboards/demo-image.png"


def test_storyboard_response_falls_back_to_image_when_thumbnail_points_to_video():
    storyboard = Storyboard(
        id=uuid.uuid4(),
        project_id=uuid.uuid4(),
        shot_number=7,
        image_url="/uploads/storyboards/demo-image.png",
        video_url="/uploads/storyboards/videos/demo-video.mp4",
        gen_params={
            "video_thumbnail_url": "/uploads/storyboards/video-thumbnails/demo-video.mp4",
        },
        sort_order=0,
        created_at=datetime(2026, 6, 12, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 12, tzinfo=timezone.utc),
    )

    response = _to_response(storyboard)

    assert response.video_thumbnail_url == "/uploads/storyboards/demo-image.png"
