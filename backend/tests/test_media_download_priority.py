from uuid import uuid4

from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.storyboard import Storyboard
from app.routers.assets import _iter_asset_download_attempts, _iter_asset_download_candidates
from app.routers.creation import (
    _build_creation_video_filename,
    _iter_creation_audio_download_attempts,
    _iter_creation_video_download_attempts,
    _iter_creation_video_download_candidates,
)
from app.routers.projects import _resolve_project_asset_media_fields
from app.routers.storyboards import (
    _resolve_storyboard_image_download_context,
    _resolve_storyboard_video_download_context,
)


def test_asset_download_candidates_prefer_explicit_download_url():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="原画视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/preview.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={
            "download_url": "https://cdn.example.com/videos/source.mov",
            "origin_url": "https://origin.example.com/videos/source.mov",
        },
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    candidates = _iter_asset_download_candidates(asset)

    assert candidates == [
        ("https://cdn.example.com/videos/source.mov", "资产下载地址"),
        ("https://origin.example.com/videos/source.mov", "资产原始地址"),
        ("/uploads/creation/global/videos/preview.mp4", "资产文件地址"),
    ]


def test_asset_download_attempts_prioritize_unified_download_url_before_legacy_candidates():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="原画视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/preview.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={
            "download_url": "https://cdn.example.com/videos/source.mov",
            "origin_url": "https://origin.example.com/videos/source.mov",
        },
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    attempts = _iter_asset_download_attempts(asset)

    assert attempts[0][1] == "资产统一下载地址"
    assert attempts[0][0].startswith("/api/media/downloads/")
    assert attempts[1:] == [
        ("https://cdn.example.com/videos/source.mov", "资产下载地址"),
        ("https://origin.example.com/videos/source.mov", "资产原始地址"),
        ("/uploads/creation/global/videos/preview.mp4", "资产文件地址"),
    ]


def test_asset_download_attempts_keep_file_first_when_not_preferring_origin():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="原画视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/preview.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={
            "download_url": "https://cdn.example.com/videos/source.mov",
            "origin_url": "https://origin.example.com/videos/source.mov",
        },
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    attempts = _iter_asset_download_attempts(asset, prefer_origin=False)

    assert attempts[0] == ("/uploads/creation/global/videos/preview.mp4", "资产文件地址")
    assert attempts[1][1] == "资产统一下载地址"
    assert attempts[1][0].startswith("/api/media/downloads/")
    assert attempts[2:] == [
        ("https://cdn.example.com/videos/source.mov", "资产下载地址"),
        ("https://origin.example.com/videos/source.mov", "资产原始地址"),
    ]


def test_creation_video_download_candidates_and_filename_prefer_original_source():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="创作视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/preview.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={
            "download_url": "https://cdn.example.com/videos/master.mov",
            "origin_url": "https://origin.example.com/videos/master.mov",
        },
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    assert _iter_creation_video_download_candidates(asset) == [
        "https://cdn.example.com/videos/master.mov",
        "https://origin.example.com/videos/master.mov",
        "/uploads/creation/global/videos/preview.mp4",
    ]
    assert _build_creation_video_filename(asset, 1) == "创作视频_1.mov"


def test_creation_video_download_attempts_prioritize_unified_download_url():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=None,
        subject_id=None,
        name="创作视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/creation/global/videos/preview.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={
            "download_url": "https://cdn.example.com/videos/master.mov",
            "origin_url": "https://origin.example.com/videos/master.mov",
        },
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    attempts = _iter_creation_video_download_attempts(asset)

    assert attempts[0].startswith("/api/media/downloads/")
    assert attempts[1:] == [
        "https://cdn.example.com/videos/master.mov",
        "https://origin.example.com/videos/master.mov",
        "/uploads/creation/global/videos/preview.mp4",
    ]


def test_creation_audio_download_attempts_prioritize_unified_download_url():
    asset_id = uuid4()
    user_id = uuid4()
    clip = AudioClip(
        id=uuid4(),
        user_id=user_id,
        project_id=None,
        storyboard_id=None,
        text="旁白",
        voice_id="voice-1",
        audio_url="/uploads/creation/audios/clip-preview.mp3",
        duration=3.2,
        speed=1.0,
        emotion=None,
        is_favorite=False,
        source="creation",
    )
    asset = Asset(
        id=asset_id,
        user_id=user_id,
        project_id=None,
        subject_id=None,
        name="创作配音",
        asset_type="audio",
        category="voiceover",
        file_url="/uploads/creation/audios/clip-master.mp3",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={"origin_url": "https://origin.example.com/audios/clip-master.wav"},
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    attempts = _iter_creation_audio_download_attempts(clip, asset=asset)

    assert attempts[0].startswith("/api/media/downloads/")
    assert attempts[1:] == [
        "/uploads/creation/audios/clip-preview.mp3",
        "/uploads/creation/audios/clip-master.mp3",
    ]


def test_project_asset_media_fields_use_controlled_download_url():
    asset = Asset(
        id=uuid4(),
        user_id=uuid4(),
        project_id=uuid4(),
        subject_id=None,
        name="项目原画",
        asset_type="image",
        category="reference",
        file_url="/uploads/projects/images/demo.png",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json=None,
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    media = _resolve_project_asset_media_fields(asset)

    assert str(media["download_url"]).startswith("/api/media/downloads/")


def test_storyboard_image_download_context_uses_controlled_download_url():
    storyboard_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()
    shot = Storyboard(
        id=storyboard_id,
        project_id=project_id,
        episode_id=None,
        shot_number=1,
        content="镜头一",
        shot_type=None,
        camera=None,
        camera_angle=None,
        composition=None,
        duration=None,
        lighting=None,
        ambient_sound=None,
        voiceover=None,
        image_prompt=None,
        image_url="/uploads/storyboards/project-1/images/shot-01.png",
        video_url=None,
        character_ids=None,
        scene_id=None,
        prop_ids=None,
        reference_image_urls=None,
        gen_params=None,
        sort_order=1,
    )
    asset = Asset(
        id=uuid4(),
        user_id=user_id,
        project_id=project_id,
        subject_id=None,
        name="分镜图",
        asset_type="image",
        category="storyboard",
        file_url="/uploads/storyboards/project-1/images/shot-01.png",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={"storyboard_id": str(storyboard_id)},
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    context = _resolve_storyboard_image_download_context(
        shot,
        asset_lookup={(str(storyboard_id), asset.file_url): asset},
    )

    assert context["source_url"] == "/uploads/storyboards/project-1/images/shot-01.png"
    assert str(context["download_url"]).startswith("/api/media/downloads/")
    assert context["matched_asset"] is asset


def test_storyboard_video_download_context_uses_controlled_download_url():
    storyboard_id = uuid4()
    project_id = uuid4()
    user_id = uuid4()
    shot = Storyboard(
        id=storyboard_id,
        project_id=project_id,
        episode_id=None,
        shot_number=2,
        content="镜头二",
        shot_type=None,
        camera=None,
        camera_angle=None,
        composition=None,
        duration=None,
        lighting=None,
        ambient_sound=None,
        voiceover=None,
        image_prompt=None,
        image_url=None,
        video_url="/uploads/storyboards/project-1/videos/shot-02.mp4",
        character_ids=None,
        scene_id=None,
        prop_ids=None,
        reference_image_urls=None,
        gen_params={"download_url": "https://cdn.example.com/storyboards/shot-02-master.mov"},
        sort_order=2,
    )
    asset = Asset(
        id=uuid4(),
        user_id=user_id,
        project_id=project_id,
        subject_id=None,
        name="分镜视频",
        asset_type="video",
        category="storyboard",
        file_url="/uploads/storyboards/project-1/videos/shot-02.mp4",
        thumbnail_url=None,
        prompt=None,
        model=None,
        size=None,
        metadata_json={"storyboard_id": str(storyboard_id)},
        is_starred=False,
        reference_image_urls=None,
        is_deleted=False,
    )

    context = _resolve_storyboard_video_download_context(
        shot,
        asset_lookup={(str(storyboard_id), asset.file_url): asset},
    )

    assert context["source_url"] == "/uploads/storyboards/project-1/videos/shot-02.mp4"
    assert str(context["download_url"]).startswith("/api/media/downloads/")
    assert context["matched_asset"] is asset
