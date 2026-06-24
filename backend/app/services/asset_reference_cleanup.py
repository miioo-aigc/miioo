"""资产删除后的业务引用单向清理。

资产删除走软删（进回收站），但 Subject / SubjectImage / Storyboard /
CreationShot / AudioClip / VideoClip / Composition 等业务表会把资产的
``file_url`` 冗余存一份，部分还额外保存 ``*_asset_id`` 引用，导致资产删除后
项目各模块仍能回显已删素材。

这里做的是「单向」清理：删除资产时把对应业务引用一并解除，但从回收站恢复资产
时不会自动挂回（恢复语义按产品确认为单向）。匹配口径以 ``asset.file_url`` 精确
相等为主，辅以 ``asset.id`` 反向 FK 引用清理。
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.audio_clip import AudioClip
from app.models.composition import Composition
from app.models.creation_shot import CreationShot
from app.models.storyboard import Storyboard
from app.models.subject import Subject
from app.models.subject_image import SubjectImage
from app.models.video_clip import VideoClip


def _asset_urls(asset: Asset) -> set[str]:
    urls = {asset.file_url}
    if asset.thumbnail_url:
        urls.add(asset.thumbnail_url)
    return {url for url in urls if url}


def _scrub_url_list(value, urls: set[str]) -> tuple[list | None, bool]:
    if not isinstance(value, list):
        return value, False
    kept = [item for item in value if not (isinstance(item, str) and item in urls)]
    if len(kept) == len(value):
        return value, False
    return (kept or None), True


def _scrub_json_refs(data, urls: set[str], asset_id: str) -> tuple[dict | None, bool]:
    """递归清理 dict 中匹配资产 URL 或 asset_id 的值。

    - 值等于资产 URL / asset_id 的标量键 -> 置空
    - 值为列表的，过滤掉匹配项
    - 嵌套 dict 递归处理
    """
    if not isinstance(data, dict):
        return data, False

    result = dict(data)
    changed = False
    for key, val in list(result.items()):
        if isinstance(val, str):
            if val in urls or val == asset_id:
                result[key] = None
                changed = True
        elif isinstance(val, list):
            kept = [
                item
                for item in val
                if not (isinstance(item, str) and (item in urls or item == asset_id))
            ]
            if len(kept) != len(val):
                result[key] = kept or None
                changed = True
        elif isinstance(val, dict):
            nested, nested_changed = _scrub_json_refs(val, urls, asset_id)
            if nested_changed:
                result[key] = nested
                changed = True
    return result, changed


async def cleanup_asset_references(asset: Asset, db: AsyncSession) -> bool:
    """删除资产时解除业务模块对该资产的展示引用。

    返回是否有业务记录被改动。调用方负责 commit。
    """
    urls = _asset_urls(asset)
    asset_id = str(asset.id)
    asset_uuid = asset.id
    project_id = asset.project_id
    changed = False

    # --- 主体本体 ---
    subject_filters = [
        (Subject.image_url.in_(urls))
        | (Subject.reference_image_url.in_(urls))
        | (Subject.reference_asset_id == asset_uuid)
    ]
    if project_id is not None:
        subject_filters.append(Subject.project_id == project_id)
    subjects = (await db.execute(select(Subject).where(*subject_filters))).scalars().all()
    for subject in subjects:
        if subject.image_url in urls:
            subject.image_url = None
            changed = True
        if subject.reference_image_url in urls:
            subject.reference_image_url = None
            changed = True
        if subject.reference_asset_id == asset_uuid:
            subject.reference_asset_id = None
            changed = True
        scrubbed, c = _scrub_json_refs(subject.gen_config, urls, asset_id)
        if c:
            subject.gen_config = scrubbed
            changed = True

    # --- 主体候选图 ---
    image_filters = [
        (SubjectImage.image_url.in_(urls)) | (SubjectImage.asset_id == asset_uuid)
    ]
    subject_images = (
        (await db.execute(select(SubjectImage).where(*image_filters))).scalars().all()
    )
    for img in subject_images:
        # image_url 非空约束，命中即删除整条候选图记录
        if img.image_url in urls:
            await db.delete(img)
            changed = True
        elif img.asset_id == asset_uuid:
            img.asset_id = None
            changed = True

    # --- 分镜 ---
    # reference_image_urls / gen_params 是 JSON，无法用 SQL 精确过滤，按项目逐条扫描。
    storyboard_query = select(Storyboard)
    if project_id is not None:
        storyboard_query = storyboard_query.where(Storyboard.project_id == project_id)
    storyboards = (await db.execute(storyboard_query)).scalars().all()
    for sb in storyboards:
        if sb.image_url in urls:
            sb.image_url = None
            changed = True
        if sb.video_url in urls:
            sb.video_url = None
            changed = True
        new_refs, c = _scrub_url_list(sb.reference_image_urls, urls)
        if c:
            sb.reference_image_urls = new_refs
            changed = True
        new_params, c = _scrub_json_refs(sb.gen_params, urls, asset_id)
        if c:
            sb.gen_params = new_params
            changed = True

    # --- 创作镜头 ---
    shot_query = select(CreationShot)
    if project_id is not None:
        shot_query = shot_query.where(CreationShot.project_id == project_id)
    shots = (await db.execute(shot_query)).scalars().all()
    for shot in shots:
        if shot.image_url in urls:
            shot.image_url = None
            changed = True
        if shot.audio_url in urls:
            shot.audio_url = None
            changed = True
        if shot.video_url in urls:
            shot.video_url = None
            changed = True
        new_refs, c = _scrub_url_list(shot.reference_image_urls, urls)
        if c:
            shot.reference_image_urls = new_refs
            changed = True
        new_meta, c = _scrub_json_refs(shot.metadata_json, urls, asset_id)
        if c:
            shot.metadata_json = new_meta
            changed = True

    # --- 配音片段 ---
    audio_query = select(AudioClip).where(AudioClip.audio_url.in_(urls))
    if project_id is not None:
        audio_query = audio_query.where(AudioClip.project_id == project_id)
    audio_clips = (await db.execute(audio_query)).scalars().all()
    for clip in audio_clips:
        # audio_url 非空约束，命中即删除整条配音记录
        await db.delete(clip)
        changed = True

    # --- 视频片段 ---
    video_query = select(VideoClip).where(VideoClip.video_url.in_(urls))
    if project_id is not None:
        video_query = video_query.where(VideoClip.project_id == project_id)
    video_clips = (await db.execute(video_query)).scalars().all()
    for clip in video_clips:
        await db.delete(clip)
        changed = True

    # --- 成片工程 ---
    comp_query = select(Composition).where(Composition.output_url.in_(urls))
    if project_id is not None:
        comp_query = comp_query.where(Composition.project_id == project_id)
    compositions = (await db.execute(comp_query)).scalars().all()
    for comp in compositions:
        comp.output_url = None
        if comp.status == "completed":
            comp.status = "draft"
        changed = True

    return changed
