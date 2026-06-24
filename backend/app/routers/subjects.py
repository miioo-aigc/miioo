import io
from pathlib import Path
from urllib.parse import quote, unquote, urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.project import Project
from app.models.episode import Episode
from app.models.subject import Subject
from app.models.subject_image import SubjectImage
from app.models.storyboard import Storyboard
from app.models.asset import Asset
from app.models.model_config import ModelConfig
from app.schemas.subject import (
    SubjectCreate,
    SubjectDetailResponse,
    SubjectFieldExtractRequest,
    SubjectFieldExtractResponse,
    SubjectGenerateConfig,
    SubjectListResponse,
    SubjectReferenceImage,
    SubjectResponse,
    SubjectUpdate,
)
from app.schemas.subject_image import SubjectImageReferenceItem, SubjectImageResponse
from app.services.asset_recycle import apply_asset_visibility
from app.services.subject_extract import extract_subject_fields, extract_subjects
from app.services.subject_extract import extract_scene_summary_from_script
from app.services.media_derivative_pipeline import build_image_derivative_bundle
from app.services.image_gen import image_gen_service
from app.services.model_selection import get_default_available_model_id
from app.services.media_fetch import read_media_bytes
from app.services.media_download_runtime import MediaDownloadAccessError, resolve_verified_download_target_from_url
from app.services.media_view_models import build_image_media_fields
from app.services.model_capabilities import (
    resolve_optional_model_toggle,
    resolve_user_model,
    validate_image_request,
)
from app.services.media_storage import persist_remote_file, persist_uploaded_file, resolve_upload_path
from app.services.project_audio import build_storyboard_narration_jobs, generate_storyboard_narration_audio
from app.services.user_api_key import (
    get_user_api_key,
    get_user_model_provider_credentials,
    get_user_model_provider_runtime,
)
from app.services.visual_styles import append_visual_styles
from app.utils.url_security import validate_outbound_url

router = APIRouter()

IMAGE_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_REFERENCE_IMAGE_SIZE = 5 * 1024 * 1024
PURE_WHITE_BACKGROUND_HINTS = (
    "纯白色背景",
    "纯白背景",
    "pure white background",
    "white background",
)


async def _get_project(project_id: str, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == UUID(project_id), Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


async def _get_subject(project_id: str, subject_id: str, db: AsyncSession) -> Subject:
    result = await db.execute(
        select(Subject).where(Subject.id == UUID(subject_id), Subject.project_id == UUID(project_id))
    )
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=404, detail="主体不存在")
    return subject


async def _auto_generate_subject_voice_clips(
    *,
    subject: Subject,
    user: User,
    db: AsyncSession,
) -> None:
    if subject.type != "character" or not subject.voice_id:
        return

    storyboards_result = await db.execute(
        select(Storyboard).where(Storyboard.project_id == subject.project_id)
    )
    storyboards = storyboards_result.scalars().all()
    if not storyboards:
        return

    related_storyboards: list[Storyboard] = []
    related_subject_ids: set[str] = set()
    subject_id_str = str(subject.id)
    for storyboard in storyboards:
        character_ids = {
            str(item)
            for item in (storyboard.character_ids or [])
            if item
        }
        if subject_id_str not in character_ids:
            continue
        related_storyboards.append(storyboard)
        related_subject_ids.update(character_ids)

    if not related_storyboards:
        return

    subjects_result = await db.execute(
        select(Subject).where(
            Subject.project_id == subject.project_id,
            Subject.id.in_([UUID(subject_id) for subject_id in related_subject_ids]),
        )
    )
    subject_map = {str(item.id): item for item in subjects_result.scalars().all()}
    subject_map[subject_id_str] = subject

    for storyboard in related_storyboards:
        jobs = build_storyboard_narration_jobs(
            storyboard,
            subject_map=subject_map,
            target_subject_id=subject_id_str,
        )
        if not jobs:
            continue
        try:
            await generate_storyboard_narration_audio(
                db=db,
                user=user,
                project_id=subject.project_id,
                storyboard=storyboard,
                subject_map=subject_map,
                source="storyboard_narration_auto",
                target_subject_id=subject_id_str,
            )
        except Exception:
            # 绑定音色本身不能因为自动生成失败而回滚，联调时可通过分镜音频列表继续观察结果。
            continue


def _reference_urls_to_subject_image_items(reference_urls: list | None) -> list[SubjectImageReferenceItem]:
    if not isinstance(reference_urls, list):
        return []

    items: list[SubjectImageReferenceItem] = []
    for index, url in enumerate(reference_urls):
        if not isinstance(url, str) or not url.strip():
            continue
        items.append(
            SubjectImageReferenceItem(
                file_url=url.strip(),
                name=f"参考图{index + 1}",
                is_primary=index == 0,
            )
        )
    return items


def _subject_image_to_response(
    img: SubjectImage,
    asset_id: str | None = None,
    asset: Asset | None = None,
) -> SubjectImageResponse:
    metadata = asset.metadata_json or {} if asset else {}
    input_prompt = metadata.get("input_prompt") or img.prompt
    media = build_image_media_fields(
        file_url=img.image_url,
        thumbnail_url=asset.thumbnail_url if asset else None,
        metadata=metadata,
        user_id=str(asset.user_id) if asset else None,
        project_id=str(asset.project_id) if asset and asset.project_id else None,
        resource_id=str(asset.id) if asset else asset_id,
    )
    return SubjectImageResponse(
        id=str(img.id),
        subject_id=str(img.subject_id),
        image_url=img.image_url,
        thumbnail_url=media["thumbnail_url"],
        preview_url=media["preview_url"],
        large_url=media["large_url"],
        download_url=media["download_url"],
        preview_ready=media["preview_ready"],
        asset_id=asset_id or (str(asset.id) if asset else None),
        is_primary=img.is_primary,
        prompt=img.prompt,
        model=img.model,
        size=img.size,
        input_prompt=input_prompt,
        ratio=metadata.get("ratio"),
        resolution=metadata.get("resolution"),
        generation_mode=img.generation_mode,
        reference_mode=metadata.get("reference_mode"),
        reference_images=_reference_urls_to_subject_image_items(asset.reference_image_urls if asset else None),
        created_at=img.created_at.isoformat(),
    )


def _merge_asset_metadata(asset: Asset, **updates) -> dict:
    metadata = dict(asset.metadata_json or {})
    metadata.update(updates)
    return metadata


def _is_reference_asset(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    return metadata.get("subject_asset_role") == "reference"


def _is_candidate_asset(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    return metadata.get("subject_asset_role") == "candidate"


def _is_primary_reference_asset(asset: Asset) -> bool:
    metadata = asset.metadata_json or {}
    if "reference_primary" in metadata:
        return bool(metadata.get("reference_primary"))
    return bool(asset.is_primary and _is_reference_asset(asset))


async def _get_subject_assets(subject_id: UUID, db: AsyncSession) -> list[Asset]:
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(Asset.subject_id == subject_id, Asset.asset_type == "image")
        )
        .order_by(Asset.created_at.desc(), Asset.id.desc())
    )
    return result.scalars().all()


async def _get_reference_images(subject_id: UUID, db: AsyncSession) -> list[SubjectReferenceImage]:
    assets = await _get_subject_assets(subject_id, db)
    references = [asset for asset in assets if _is_reference_asset(asset)]
    references.sort(key=lambda item: (not _is_primary_reference_asset(item), item.created_at), reverse=False)
    response: list[SubjectReferenceImage] = []
    for asset in references:
        media = build_image_media_fields(
            file_url=asset.file_url,
            thumbnail_url=asset.thumbnail_url,
            metadata=asset.metadata_json or {},
            user_id=str(asset.user_id),
            project_id=str(asset.project_id) if asset.project_id else None,
            resource_id=str(asset.id),
        )
        response.append(
            SubjectReferenceImage(
                asset_id=str(asset.id),
                file_url=asset.file_url,
                thumbnail_url=media["thumbnail_url"],
                preview_url=media["preview_url"],
                large_url=media["large_url"],
                download_url=media["download_url"],
                name=asset.name,
                is_primary=_is_primary_reference_asset(asset),
                created_at=asset.created_at.isoformat(),
            )
        )
    return response


async def _get_subject_image_asset_map(subject_id: UUID, db: AsyncSession) -> dict[str, Asset]:
    assets = await _get_subject_assets(subject_id, db)
    asset_map: dict[str, Asset] = {}
    for asset in assets:
        if _is_candidate_asset(asset):
            asset_map[asset.file_url] = asset
    return asset_map


async def _read_media_bytes(url: str, timeout: float = 60.0) -> bytes:
    return await read_media_bytes(
        url,
        label="主体资源地址",
        timeout=timeout,
        follow_redirects=True,
    )


def _build_subject_image_filename(subject: Subject, image_url: str) -> str:
    parsed = urlparse(image_url)
    suffix = Path(unquote(parsed.path or image_url)).suffix.lower() or ".png"
    safe_name = (subject.name or "subject-image").strip() or "subject-image"
    return f"{safe_name}{suffix}"


async def _get_latest_generate_config(subject_id: UUID, db: AsyncSession) -> SubjectGenerateConfig | None:
    assets = await _get_subject_assets(subject_id, db)
    latest_asset = next((asset for asset in assets if _is_candidate_asset(asset)), None)
    if latest_asset:
        metadata = latest_asset.metadata_json or {}
        input_prompt = metadata.get("input_prompt") or latest_asset.prompt
        return SubjectGenerateConfig(
            input_prompt=input_prompt,
            prompt=input_prompt,
            model=latest_asset.model,
            size=latest_asset.size,
            watermark=metadata.get("watermark"),
            ratio=metadata.get("ratio"),
            resolution=metadata.get("resolution"),
            generation_mode=metadata.get("generation_mode"),
            reference_mode=metadata.get("reference_mode"),
        )

    image_result = await db.execute(
        select(SubjectImage)
        .where(SubjectImage.subject_id == subject_id)
        .order_by(SubjectImage.created_at.desc(), SubjectImage.id.desc())
        .limit(1)
    )
    latest_image = image_result.scalar_one_or_none()
    if not latest_image:
        return None
    return SubjectGenerateConfig(
        input_prompt=latest_image.prompt,
        prompt=latest_image.prompt,
        model=latest_image.model,
        size=latest_image.size,
    )


async def _sync_candidate_primary_state(subject: Subject, primary_image: SubjectImage | None, db: AsyncSession) -> None:
    asset_result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.subject_id == subject.id,
                Asset.asset_type == "image",
            )
        )
    )
    for asset in asset_result.scalars().all():
        if _is_candidate_asset(asset):
            asset.is_primary = primary_image is not None and asset.file_url == primary_image.image_url

    subject.image_url = primary_image.image_url if primary_image else None


async def _build_subject_detail(subject: Subject, db: AsyncSession) -> SubjectDetailResponse:
    subject_response = await _to_response(subject, db)
    asset_map = await _get_subject_image_asset_map(subject.id, db)
    image_result = await db.execute(
        select(SubjectImage)
        .where(SubjectImage.subject_id == subject.id)
        .order_by(SubjectImage.created_at.desc(), SubjectImage.id.desc())
    )
    images = image_result.scalars().all()
    candidate_images = [
        _subject_image_to_response(
            img,
            asset=asset_map.get(img.image_url),
        )
        for img in images
    ]
    primary_image = next((img for img in images if img.is_primary), None)
    return SubjectDetailResponse(
        subject=subject_response,
        primary_image=_subject_image_to_response(
            primary_image,
            asset=asset_map.get(primary_image.image_url),
        ) if primary_image else None,
        candidate_images=candidate_images,
        reference_images=await _get_reference_images(subject.id, db),
        latest_generate_config=await _get_latest_generate_config(subject.id, db),
    )


def _build_subject_prompt(subject: Subject, preferred_prompt: str | None = None) -> str:
    prompt = preferred_prompt or subject.prompt
    if prompt:
        return prompt

    if subject.type == "character":
        parts = []
        # 基础身份
        identity = subject.name
        if subject.gender:
            identity = f"{subject.gender}{identity}"
        if subject.age:
            identity = f"{identity}，{subject.age}"
        parts.append(identity)
        # 外貌是角色图片最关键的描述
        if subject.appearance:
            parts.append(subject.appearance)
        # 性格影响表情和气质
        if subject.personality:
            parts.append(f"气质{subject.personality}")
        # description 作为补充
        if subject.description and subject.description != subject.appearance:
            parts.append(subject.description)
        parts.extend(["单人主体", "纯白色背景", "无场景环境", "无其他人物"])
        return "，".join(parts)

    elif subject.type == "scene":
        parts = [subject.name]
        if subject.description:
            parts.append(subject.description)
        if subject.time_setting:
            parts.append(subject.time_setting)
        if subject.atmosphere:
            parts.append(f"氛围：{subject.atmosphere}")
        parts.extend(["纯场景空间", "场景内不出现人物", "无人空镜"])
        return "，".join(parts)

    elif subject.type == "prop":
        parts = [subject.name]
        if subject.description:
            parts.append(subject.description)
        parts.extend(["单个道具主体", "主视图", "纯白色背景", "仅保留道具物品", "无人物无手持"])
        return "，".join(parts)

    # fallback
    parts = [subject.name]
    if subject.appearance:
        parts.append(subject.appearance)
    if subject.description:
        parts.append(subject.description)
    return "，".join(part for part in parts if part)


def _normalize_subject_generation_mode(generation_mode: str | None) -> str | None:
    normalized = (generation_mode or "").strip().lower().replace("-", "_")
    if not normalized:
        return None
    if normalized == "multi_view":
        return "three_view"
    if normalized in {"single", "three_view"}:
        return normalized
    return normalized


def _is_character_three_view_mode(subject: Subject, generation_mode: str | None) -> bool:
    return subject.type == "character" and _normalize_subject_generation_mode(generation_mode) == "three_view"


def _build_character_three_view_prompt(subject: Subject, preferred_prompt: str | None = None) -> str:
    character_summary = _build_subject_prompt(subject, preferred_prompt)
    detail_parts = []
    if subject.name:
        detail_parts.append(f"Name: {subject.name}")
    if subject.gender:
        detail_parts.append(f"Gender: {subject.gender}")
    if subject.age:
        detail_parts.append(f"Age: {subject.age}")
    if subject.personality:
        detail_parts.append(f"Personality: {subject.personality}")
    if subject.background:
        detail_parts.append(f"Background: {subject.background}")
    if character_summary:
        detail_parts.append(f"Character details: {character_summary}")

    return " ".join(
        part
        for part in [
            "Create ONE character multi-view reference sheet with 4 fixed panels.",
            "Show the SAME character as a face close-up portrait, a Front Full Body view, a Side Full Body view, and a Back Full Body view.",
            "Arrange the four panels as a single clean character design reference sheet.",
            "The face close-up must clearly show facial features, hairstyle, and expression, while the other three panels must remain full body from head to toe.",
            "Keep face, hair, body proportions, clothing, materials, colors, and accessories fully consistent across all four views.",
            "Use a pure white background with flat, clear, reference-friendly lighting.",
            "Avoid extra props, duplicate characters, dramatic action poses, perspective distortion, cropped body views, and any extra panels beyond these four views.",
            "Top priority: the character must look like the same person in every panel, especially matching the face close-up with the three body views.",
            " ".join(detail_parts),
        ]
        if part
    )


def _resolve_subject_generation_prompt(
    subject: Subject,
    preferred_prompt: str | None,
    generation_mode: str | None,
) -> str:
    if _is_character_three_view_mode(subject, generation_mode):
        return _build_character_three_view_prompt(subject, preferred_prompt)
    return _build_subject_prompt(subject, preferred_prompt)


def _build_subject_style_suffix(subject: Subject, generation_mode: str | None) -> list[str]:
    if subject.type == "scene":
        return [
            "empty environment shot",
            "no people, no characters, no human silhouette",
            "focus on architecture, set dressing, and atmosphere",
        ]
    if subject.type == "prop":
        return [
            "single prop only",
            "hero view",
            "isolated object with no hands, no people, no extra objects",
        ]
    if subject.type != "character":
        return []
    if _is_character_three_view_mode(subject, generation_mode):
        return [
            "single character multi-view reference sheet",
            "face close-up plus front full body, side full body, and back full body views",
            "consistent identity across all four views",
        ]
    return ["consistent character appearance, same person across images"]


def _should_force_pure_white_background(subject: Subject) -> bool:
    return subject.type in {"character", "prop"}


def _append_pure_white_background_suffix(prompt: str, subject: Subject) -> str:
    if not prompt or not _should_force_pure_white_background(subject):
        return prompt
    lowered = prompt.lower()
    if any(hint in lowered for hint in PURE_WHITE_BACKGROUND_HINTS):
        return prompt
    return (
        f"{prompt}, 纯白色背景, pure white background, "
        "isolated subject, no environment, no scene props"
    )


async def _get_reference_image_urls_for_generation(
    subject_id: UUID,
    reference_mode: str | None,
    db: AsyncSession,
) -> list[str]:
    normalized_mode = (reference_mode or "auto").strip().lower()
    if normalized_mode == "ignore_reference":
        return []

    references = await _get_reference_images(subject_id, db)
    urls = [item.file_url for item in references if item.file_url]
    if normalized_mode in {"auto", "use_reference"}:
        return urls
    return urls


async def _create_candidate_image_and_asset(
    *,
    user_id: UUID,
    project_id: str,
    subject: Subject,
    image_url: str,
    prompt: str,
    model: str | None,
    size: str | None,
    is_primary: bool,
    watermark: bool | None,
    ratio: str | None,
    resolution: str | None,
    generation_mode: str | None,
    reference_mode: str | None,
    db: AsyncSession,
) -> tuple[SubjectImage, Asset]:
    derivative_bundle = build_image_derivative_bundle(
        image_url,
        preview_subdir="derived/subjects/preview",
        asset_type="image",
    )
    thumbnail_url = derivative_bundle["thumbnail_url"]
    preview_url = derivative_bundle["preview_url"]

    image = SubjectImage(
        subject_id=subject.id,
        image_url=image_url,
        is_primary=is_primary,
        asset_id=None,
        prompt=prompt,
        model=model,
        size=size,
        generation_mode=generation_mode,
    )
    db.add(image)
    await db.flush()

    asset = Asset(
        user_id=user_id,
        project_id=UUID(project_id),
        subject_id=subject.id,
        name=f"{subject.name} - 生成图",
        asset_type="image",
        category=subject.type,
        file_url=image_url,
        thumbnail_url=thumbnail_url,
        prompt=prompt,
        model=model,
        size=size,
        is_primary=is_primary,
        metadata_json={
            "subject_asset_role": "candidate",
            "watermark": watermark,
            "ratio": ratio,
            "resolution": resolution,
            "generation_mode": generation_mode,
            "reference_mode": reference_mode,
            **derivative_bundle["metadata_updates"],
        },
    )
    db.add(asset)
    await db.flush()
    image.asset_id = asset.id
    return image, asset


async def _to_response(s: Subject, db: AsyncSession) -> SubjectResponse:
    # 获取定版图和候选图数量
    img_result = await db.execute(
        select(SubjectImage).where(SubjectImage.subject_id == s.id, SubjectImage.is_primary == True)
    )
    primary_img = img_result.scalar_one_or_none()

    count_result = await db.execute(
        select(sa_func.count()).where(SubjectImage.subject_id == s.id)
    )
    image_count = count_result.scalar() or 0

    primary_url = primary_img.image_url if primary_img else s.image_url
    assets = await _get_subject_assets(s.id, db)
    asset_by_file_url = {asset.file_url: asset for asset in assets}
    primary_asset = asset_by_file_url.get(primary_url) if primary_url else None
    media = build_image_media_fields(
        file_url=primary_url,
        thumbnail_url=primary_asset.thumbnail_url if primary_asset else None,
        metadata=primary_asset.metadata_json if primary_asset else None,
        user_id=str(primary_asset.user_id) if primary_asset else None,
        project_id=str(primary_asset.project_id) if primary_asset and primary_asset.project_id else str(s.project_id),
        resource_id=str(primary_asset.id) if primary_asset else None,
    )

    return SubjectResponse(
        id=str(s.id),
        project_id=str(s.project_id),
        episode_id=str(s.episode_id) if s.episode_id else None,
        type=s.type,
        name=s.name,
        role=s.role,
        description=s.description,
        appearance=s.appearance,
        personality=s.personality,
        prompt=s.prompt,
        image_url=s.image_url,
        thumbnail_url=media["thumbnail_url"],
        preview_url=media["preview_url"],
        large_url=media["large_url"],
        download_url=media["download_url"],
        preview_ready=media["preview_ready"],
        is_global=s.is_global,
        age=s.age,
        gender=s.gender,
        background=s.background,
        scene_type=s.scene_type,
        time_setting=s.time_setting,
        atmosphere=s.atmosphere,
        importance=s.importance,
        owner_subject_id=str(s.owner_subject_id) if s.owner_subject_id else None,
        voice_id=s.voice_id,
        reference_image_url=s.reference_image_url,
        reference_asset_id=str(s.reference_asset_id) if s.reference_asset_id else None,
        gen_config=s.gen_config,
        primary_image_url=primary_url,
        image_count=image_count,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


async def _get_default_image_model(user_id: UUID, db: AsyncSession) -> str:
    return await get_default_available_model_id(
        user_id,
        db,
        category="image",
        fallback_model_id="doubao-seedream-5.0-lite",
    )


@router.get(
    "",
    response_model=SubjectListResponse,
    summary="获取主体列表",
    description="返回项目下的主体列表，可按类型和分集过滤，并支持标准分页。`episode_id` 过滤时会同时返回全局主体。",
    response_description="主体分页列表。",
)
async def list_subjects(
    project_id: str,
    type: str | None = Query(None, pattern="^(character|scene|prop)$"),
    episode_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    query = select(Subject).where(Subject.project_id == UUID(project_id))
    count_query = select(sa_func.count()).select_from(Subject).where(Subject.project_id == UUID(project_id))
    if type:
        query = query.where(Subject.type == type)
        count_query = count_query.where(Subject.type == type)
    if episode_id:
        query = query.where((Subject.episode_id == UUID(episode_id)) | (Subject.is_global == True))
        count_query = count_query.where((Subject.episode_id == UUID(episode_id)) | (Subject.is_global == True))
    query = query.order_by(Subject.sort_order, Subject.created_at, Subject.id)
    query = query.limit(limit).offset(offset)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    result = await db.execute(query)
    subjects = result.scalars().all()
    items = [await _to_response(s, db) for s in subjects]
    has_more = offset + len(items) < total
    return SubjectListResponse(
        list=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=has_more,
        hasMore=has_more,
    )


@router.get(
    "/{subject_id}",
    response_model=SubjectDetailResponse,
    summary="获取主体详情",
    description="返回主体基础信息、定版图、候选图、参考图和最近一次生成配置。",
    response_description="主体详情。",
)
async def get_subject_detail(
    project_id: str,
    subject_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)
    return await _build_subject_detail(subject, db)


@router.post(
    "",
    response_model=SubjectResponse,
    status_code=201,
    summary="创建主体",
    description="手动创建角色、场景或道具主体。",
    response_description="创建成功后的主体。",
)
async def create_subject(
    project_id: str,
    req: SubjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = Subject(
        project_id=UUID(project_id),
        episode_id=UUID(req.episode_id) if req.episode_id else None,
        type=req.type,
        name=req.name,
        role=req.role,
        description=req.description,
        appearance=req.appearance,
        personality=req.personality,
        prompt=req.prompt,
        is_global=req.is_global,
        age=req.age,
        gender=req.gender,
        background=req.background,
        scene_type=req.scene_type,
        time_setting=req.time_setting,
        atmosphere=req.atmosphere,
        importance=req.importance,
        voice_id=req.voice_id,
        owner_subject_id=UUID(req.owner_subject_id) if req.owner_subject_id else None,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return await _to_response(subject, db)


@router.patch(
    "/{subject_id}",
    response_model=SubjectResponse,
    summary="更新主体",
    description="更新主体的基础信息与结构化字段，例如外貌、性格、背景、场景类型或绑定音色。",
    response_description="更新后的主体。",
)
async def update_subject(
    project_id: str,
    subject_id: str,
    req: SubjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)
    previous_voice_id = subject.voice_id

    update_fields = [
        "name", "role", "description", "appearance", "personality", "prompt",
        "image_url", "is_global", "age", "gender", "background",
        "scene_type", "time_setting", "atmosphere", "importance", "voice_id",
    ]
    for field in update_fields:
        value = getattr(req, field)
        if value is not None:
            setattr(subject, field, value)

    if req.owner_subject_id is not None:
        subject.owner_subject_id = UUID(req.owner_subject_id) if req.owner_subject_id else None

    await db.commit()
    await db.refresh(subject)
    if req.voice_id is not None and req.voice_id != previous_voice_id:
        await _auto_generate_subject_voice_clips(subject=subject, user=user, db=db)
    return await _to_response(subject, db)


@router.delete(
    "/{subject_id}",
    summary="删除主体",
    description="删除指定主体。",
    response_description="删除结果。",
)
async def delete_subject(
    project_id: str,
    subject_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)
    await db.delete(subject)
    await db.commit()
    return {"message": "已删除"}


# --- 主体提取 ---

@router.post(
    "/extract",
    response_model=list[SubjectResponse],
    summary="从分集剧本提取主体",
    description="基于指定 `episode_id` 的正式分集剧本，自动抽取角色、场景和道具主体。",
    response_description="本次抽取创建的主体列表。",
)
async def extract_from_episode(
    project_id: str,
    episode_id: str = Query(...),
    model: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    result = await db.execute(
        select(Episode).where(Episode.id == UUID(episode_id), Episode.project_id == UUID(project_id))
    )
    episode = result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="集数不存在")
    if not episode.content:
        raise HTTPException(status_code=400, detail="该集剧本为空，请先生成或编辑剧本")

    key_data = await get_user_model_provider_credentials(
        user.id,
        db,
        category="chat",
        requested_model=model,
    )
    if not key_data:
        detail = "当前没有可用的对话模型，请先在 API 配置中启用一个 chat 模型"
        if model:
            detail = f"未找到可用的对话模型 {model}，请先在 API 配置中启用"
        raise HTTPException(status_code=400, detail=detail)

    api_key, base_url, _, resolved_model_id = key_data

    try:
        extracted = await extract_subjects(
            episode.content,
            api_key=api_key,
            base_url=base_url,
            model=resolved_model_id,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 提取失败: {str(e)}")

    created = []
    for char in extracted.get("characters", []):
        s = Subject(
            project_id=UUID(project_id),
            episode_id=UUID(episode_id),
            type="character",
            name=char["name"],
            role=char.get("role"),
            description=char.get("description"),
            appearance=char.get("appearance"),
            personality=char.get("personality"),
            age=char.get("age"),
            gender=char.get("gender"),
            background=char.get("background"),
            prompt=char.get("prompt"),
        )
        db.add(s)
        created.append(s)

    for scene in extracted.get("scenes", []):
        s = Subject(
            project_id=UUID(project_id),
            episode_id=UUID(episode_id),
            type="scene",
            name=scene["name"],
            description=scene.get("description"),
            scene_type=scene.get("scene_type"),
            time_setting=scene.get("time"),
            atmosphere=scene.get("atmosphere"),
            prompt=scene.get("prompt"),
        )
        db.add(s)
        created.append(s)

    for prop in extracted.get("props", []):
        s = Subject(
            project_id=UUID(project_id),
            episode_id=UUID(episode_id),
            type="prop",
            name=prop["name"],
            description=prop.get("description"),
            importance=prop.get("importance"),
            prompt=prop.get("prompt"),
        )
        db.add(s)
        created.append(s)

    await db.commit()
    for s in created:
        await db.refresh(s)

    return [await _to_response(s, db) for s in created]


@router.post(
    "/{subject_id}/extract-fields",
    response_model=SubjectFieldExtractResponse,
    summary="提取主体结构化字段",
    description="根据主体类型和描述文本，自动提取角色/场景/道具的结构化字段。",
    response_description="提取出的主体结构化字段。",
)
async def extract_subject_structured_fields(
    project_id: str,
    subject_id: str,
    req: SubjectFieldExtractRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    description = (req.description or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="请先填写描述梗概")

    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data

    try:
        extracted = await extract_subject_fields(
            subject_type=subject.type,
            name=req.name or subject.name,
            description=description,
            api_key=api_key,
            base_url=base_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 提取失败: {str(e)}")

    return SubjectFieldExtractResponse(type=subject.type, **extracted)


class SceneSummaryExtractResponse(BaseModel):
    description: str | None = None
    time_setting: str | None = None
    atmosphere: str | None = None
    scene_type: str | None = None


@router.post(
    "/{subject_id}/extract-scene-summary",
    response_model=SceneSummaryExtractResponse,
    summary="提取场景梗概",
    description="仅对 `scene` 类型主体可用。从其绑定分集剧本中抽取场景描述、时间、氛围和场景类型。",
    response_description="提取出的场景梗概。",
)
async def extract_scene_summary(
    project_id: str,
    subject_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    if subject.type != "scene":
        raise HTTPException(status_code=400, detail="仅场景主体支持自动抽取场景梗概")
    if not subject.episode_id:
        raise HTTPException(status_code=400, detail="当前场景未绑定分集，无法从剧本自动抽取")

    episode_result = await db.execute(
        select(Episode).where(
            Episode.id == subject.episode_id,
            Episode.project_id == UUID(project_id),
        )
    )
    episode = episode_result.scalar_one_or_none()
    if not episode:
        raise HTTPException(status_code=404, detail="场景所属分集不存在")

    script_content = (episode.content or "").strip()
    if not script_content:
        raise HTTPException(status_code=400, detail="当前分集剧本为空，无法自动抽取场景梗概")

    key_data = await get_user_api_key(user.id, db)
    if not key_data:
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中配置")

    api_key, base_url = key_data

    try:
        extracted = await extract_scene_summary_from_script(
            scene_name=subject.name,
            script_content=script_content,
            existing_description=subject.description,
            api_key=api_key,
            base_url=base_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 提取失败: {str(e)}")

    return SceneSummaryExtractResponse(**extracted)


# --- 图片生成与候选图管理 ---

class ReferenceAssetBindRequest(BaseModel):
    asset_ids: list[str]
    primary_asset_id: str | None = None


class GenerateImageRequest(BaseModel):
    input_prompt: str | None = None
    prompt: str | None = None
    model: str | None = None
    size: str = "2K"
    watermark: bool | None = None
    ratio: str | None = None
    resolution: str | None = None
    count: int | None = None
    image_count: int | None = None
    imageCount: int | None = None
    generation_mode: str | None = None
    reference_mode: str | None = None

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1


@router.post(
    "/{subject_id}/reference-images/upload",
    response_model=SubjectReferenceImage,
    status_code=201,
    summary="上传主体参考图",
    description="为主体上传参考图。第一张参考图会自动标记为主参考图。",
    response_description="上传后的参考图信息。",
)
async def upload_subject_reference_image(
    project_id: str,
    subject_id: str,
    file: UploadFile = File(..., description="主体参考图文件，支持 jpg / jpeg / png / gif / webp，大小不超过 5MB。"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    try:
        file_url = await persist_uploaded_file(
            file,
            f"subjects/{project_id}/references",
            allowed_extensions=IMAGE_ALLOWED_EXTENSIONS,
            allowed_content_types=IMAGE_ALLOWED_CONTENT_TYPES,
            max_size=MAX_REFERENCE_IMAGE_SIZE,
            fallback_extension=".png",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    existing_references = await _get_reference_images(subject.id, db)
    is_primary = len(existing_references) == 0
    derivative_bundle = build_image_derivative_bundle(
        file_url,
        preview_subdir="derived/subjects/references/preview",
        asset_type="image",
    )
    thumbnail_url = derivative_bundle["thumbnail_url"]
    preview_url = derivative_bundle["preview_url"]
    asset = Asset(
        user_id=user.id,
        project_id=UUID(project_id),
        subject_id=subject.id,
        name=f"{subject.name} - 参考图",
        asset_type="image",
        category=subject.type,
        file_url=file_url,
        thumbnail_url=thumbnail_url,
        is_primary=False,
        metadata_json={
            "subject_asset_role": "reference",
            "source": "upload",
            "reference_primary": is_primary,
            **derivative_bundle["metadata_updates"],
        },
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return SubjectReferenceImage(
        asset_id=str(asset.id),
        file_url=asset.file_url,
        thumbnail_url=thumbnail_url,
        preview_url=preview_url,
        download_url=asset.file_url,
        name=asset.name,
        is_primary=is_primary,
        created_at=asset.created_at.isoformat(),
    )


@router.post(
    "/{subject_id}/reference-images/bind",
    response_model=list[SubjectReferenceImage],
    summary="绑定已有资产为主体参考图",
    description="将资产库中的图片绑定为当前主体的参考图，并指定主参考图。",
    response_description="绑定后的参考图列表。",
)
async def bind_subject_reference_images(
    project_id: str,
    subject_id: str,
    req: ReferenceAssetBindRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    if not req.asset_ids:
        raise HTTPException(status_code=400, detail="请至少选择一个资产")

    target_ids = {UUID(asset_id) for asset_id in req.asset_ids}
    result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.id.in_(target_ids),
                Asset.user_id == user.id,
                Asset.asset_type == "image",
            )
        )
    )
    assets = result.scalars().all()
    if len(assets) != len(target_ids):
        raise HTTPException(status_code=404, detail="部分资产不存在")

    primary_asset_id = req.primary_asset_id or (req.asset_ids[0] if req.asset_ids else None)
    existing_assets = await _get_subject_assets(subject.id, db)
    for existing_asset in existing_assets:
        if _is_reference_asset(existing_asset):
            existing_asset.is_primary = False
            existing_asset.metadata_json = _merge_asset_metadata(existing_asset, reference_primary=False)

    for asset in assets:
        asset.subject_id = subject.id
        asset.project_id = asset.project_id or UUID(project_id)
        asset.category = subject.type
        asset.is_primary = False
        asset.metadata_json = _merge_asset_metadata(
            asset,
            subject_asset_role="reference",
            source="asset_binding",
            reference_primary=str(asset.id) == primary_asset_id,
        )

    await db.commit()
    return await _get_reference_images(subject.id, db)


@router.post(
    "/{subject_id}/generate-image",
    response_model=SubjectImageResponse,
    summary="生成主体图片",
    description="为主体生成候选图。会综合主体信息、项目视觉风格和参考图生成，并返回首张候选图。",
    response_description="生成后的候选图对象。",
)
async def generate_subject_image(
    project_id: str,
    subject_id: str,
    req: GenerateImageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    normalized_generation_mode = _normalize_subject_generation_mode(req.generation_mode)
    user_input_prompt = (req.input_prompt or req.prompt or "").strip() or None
    generation_prompt = (req.prompt or "").strip() or None
    prompt = _resolve_subject_generation_prompt(subject, generation_prompt, normalized_generation_mode)
    if not prompt:
        raise HTTPException(status_code=400, detail="请提供生成提示词或先填写主体描述")

    requested_model = req.model or await _get_default_image_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="image",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    provider_runtime = await get_user_model_provider_runtime(
        user.id,
        db,
        category="image",
        requested_model=model,
    )
    if not provider_runtime:
        raise HTTPException(status_code=400, detail="未配置图片模型对应服务商，请先在设置中配置")
    api_key, base_url, _, model, default_image_watermark, _ = provider_runtime
    watermark = resolve_optional_model_toggle(
        model_id=model,
        category="image",
        capability_key="supports_watermark_toggle",
        requested_value=req.watermark,
        default_value=default_image_watermark,
    )
    validated = validate_image_request(
        model=model,
        size=req.size,
        aspect_ratio=req.ratio,
        resolution=req.resolution,
        count=req.resolved_count(),
        watermark=watermark,
    )

    enhanced_prompt = await append_visual_styles(prompt, [project.visual_style], user.id, db)
    style_parts = _build_subject_style_suffix(subject, normalized_generation_mode)
    if style_parts:
        enhanced_prompt = f"{enhanced_prompt}, {', '.join(style_parts)}"
    enhanced_prompt = _append_pure_white_background_suffix(enhanced_prompt, subject)

    reference_images = await _get_reference_image_urls_for_generation(
        subject.id,
        req.reference_mode,
        db,
    )

    try:
        urls = await image_gen_service.generate(
            prompt=enhanced_prompt,
            api_key=api_key,
            base_url=base_url,
            model=model,
            size=validated["size"],
            aspect_ratio=validated["aspect_ratio"],
            resolution=validated["resolution"],
            reference_images=reference_images,
            n=validated["count"],
            watermark=watermark,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"图片生成失败: {str(e)}")

    if not urls:
        raise HTTPException(status_code=502, detail="图片生成未返回结果")

    existing = await db.execute(select(SubjectImage).where(SubjectImage.subject_id == subject.id))
    has_existing = existing.scalars().first() is not None
    if user_input_prompt:
        subject.prompt = user_input_prompt

    img = None
    asset = None
    for index, remote_url in enumerate(urls):
        persisted_url = await persist_remote_file(
            remote_url,
            f"subjects/{project_id}",
            fallback_extension=".png",
        )

        next_img, next_asset = await _create_candidate_image_and_asset(
            user_id=user.id,
            project_id=project_id,
            subject=subject,
            image_url=persisted_url,
            prompt=enhanced_prompt,
            model=model,
            size=validated["size"],
            is_primary=not has_existing and index == 0,
            watermark=watermark,
            ratio=validated["aspect_ratio"],
            resolution=validated["resolution"],
            generation_mode=normalized_generation_mode,
            reference_mode=req.reference_mode,
            db=db,
        )
        next_asset.metadata_json = {
            **(next_asset.metadata_json or {}),
            "input_prompt": user_input_prompt,
        }
        if img is None:
            img = next_img
            asset = next_asset
            if not has_existing:
                subject.image_url = persisted_url

    if img is None or asset is None:
        raise HTTPException(status_code=502, detail="图片生成未返回可保存结果")

    await db.commit()
    await db.refresh(img)
    await db.refresh(asset)

    return _subject_image_to_response(img, asset=asset)


@router.get(
    "/{subject_id}/images",
    response_model=list[SubjectImageResponse],
    summary="获取主体候选图列表",
    description="返回主体的候选图与定版图列表，按创建时间倒序排列。",
    response_description="主体候选图列表。",
)
async def list_subject_images(
    project_id: str,
    subject_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    await _get_subject(project_id, subject_id, db)

    subject_uuid = UUID(subject_id)
    result = await db.execute(
        select(SubjectImage)
        .where(SubjectImage.subject_id == subject_uuid)
        .order_by(SubjectImage.created_at.desc(), SubjectImage.id.desc())
    )
    images = result.scalars().all()
    asset_map = await _get_subject_image_asset_map(subject_uuid, db)
    return [_subject_image_to_response(img, asset=asset_map.get(img.image_url)) for img in images]


@router.patch(
    "/{subject_id}/images/{image_id}/set-primary",
    response_model=SubjectImageResponse,
    summary="设置主体定版图",
    description="将指定候选图设为主体定版图，并同步更新主体主图引用。",
    response_description="新的定版图对象。",
)
async def set_primary_image(
    project_id: str,
    subject_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    subject_uuid = UUID(subject_id)

    # 取消当前定版
    result = await db.execute(
        select(SubjectImage).where(SubjectImage.subject_id == subject_uuid, SubjectImage.is_primary == True)
    )
    for img in result.scalars().all():
        img.is_primary = False

    # 设置新定版
    result = await db.execute(
        select(SubjectImage).where(SubjectImage.id == UUID(image_id), SubjectImage.subject_id == subject_uuid)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="图片不存在")

    target.is_primary = True
    await _sync_candidate_primary_state(subject, target, db)

    await db.commit()
    await db.refresh(target)
    asset_map = await _get_subject_image_asset_map(subject_uuid, db)
    return _subject_image_to_response(target, asset=asset_map.get(target.image_url))


@router.delete(
    "/{subject_id}/images/{image_id}",
    summary="删除主体候选图",
    description="删除指定主体候选图。若删除的是定版图，会自动把最新一张剩余图片设为新的定版图。",
    response_description="删除结果。",
)
async def delete_subject_image(
    project_id: str,
    subject_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)
    subject_uuid = UUID(subject_id)

    result = await db.execute(
        select(SubjectImage).where(SubjectImage.id == UUID(image_id), SubjectImage.subject_id == subject_uuid)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="图片不存在")

    was_primary = img.is_primary
    asset_result = await db.execute(
        apply_asset_visibility(
            select(Asset).where(
                Asset.subject_id == subject_uuid,
                Asset.asset_type == "image",
                Asset.file_url == img.image_url,
            ),
            include_deleted=True,
        )
    )
    linked_assets = asset_result.scalars().all()
    for asset in linked_assets:
        if _is_candidate_asset(asset):
            await db.delete(asset)

    await db.delete(img)

    # 如果删除的是定版图，自动将最新一张设为定版
    next_img = None
    if was_primary:
        result = await db.execute(
            select(SubjectImage)
            .where(SubjectImage.subject_id == subject_uuid, SubjectImage.id != img.id)
            .order_by(SubjectImage.created_at.desc(), SubjectImage.id.desc())
            .limit(1)
        )
        next_img = result.scalar_one_or_none()
        if next_img:
            next_img.is_primary = True

    await _sync_candidate_primary_state(subject, next_img, db)

    await db.commit()
    return {"message": "已删除"}


@router.get(
    "/{subject_id}/images/{image_id}/download",
    summary="下载主体图片",
    description="下载指定主体候选图或定版图。",
    response_description="图片二进制流。",
)
async def download_subject_image(
    project_id: str,
    subject_id: str,
    image_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    subject = await _get_subject(project_id, subject_id, db)

    result = await db.execute(
        select(SubjectImage).where(
            SubjectImage.id == UUID(image_id),
            SubjectImage.subject_id == UUID(subject_id),
        )
    )
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")

    try:
        asset_map = await _get_subject_image_asset_map(UUID(subject_id), db)
        asset = asset_map.get(image.image_url)
        if asset:
            media = build_image_media_fields(
                file_url=image.image_url,
                thumbnail_url=asset.thumbnail_url,
                metadata=asset.metadata_json or {},
                user_id=str(asset.user_id),
                project_id=str(asset.project_id) if asset.project_id else str(subject.project_id),
                resource_id=str(asset.id),
            )
            download_target = resolve_verified_download_target_from_url(
                str(media["download_url"] or image.image_url),
                expected_user_id=str(user.id),
            )
        else:
            download_target = image.image_url
        content = await _read_media_bytes(download_target)
    except MediaDownloadAccessError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"下载图片失败: {str(exc)}") from exc

    filename = _build_subject_image_filename(subject, image.image_url)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


# --- 批量生成 ---

class BatchGenerateRequest(BaseModel):
    subject_ids: list[str]
    model: str | None = None
    size: str = "2K"
    watermark: bool | None = None
    ratio: str | None = None
    resolution: str | None = None
    count: int | None = None
    image_count: int | None = None
    imageCount: int | None = None
    generation_mode: str | None = None
    reference_mode: str | None = None

    def resolved_count(self) -> int:
        return self.image_count or self.imageCount or self.count or 1


class BatchGenerateResult(BaseModel):
    subject_id: str
    success: bool
    image_url: str | None = None
    error: str | None = None


@router.post(
    "/batch-generate",
    response_model=list[BatchGenerateResult],
    summary="批量生成主体图片",
    description="对多个主体批量执行图片生成，每个主体返回各自的成功或失败结果。",
    response_description="批量生成结果列表。",
)
async def batch_generate_images(
    project_id: str,
    req: BatchGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(project_id, user, db)

    requested_model = req.model or await _get_default_image_model(user.id, db)
    model = await resolve_user_model(
        db=db,
        user_id=user.id,
        category="image",
        requested_model=requested_model,
        fallback_model=requested_model,
    )
    provider_runtime = await get_user_model_provider_runtime(
        user.id,
        db,
        category="image",
        requested_model=model,
    )
    if not provider_runtime:
        raise HTTPException(status_code=400, detail="未配置图片模型对应服务商，请先在设置中配置")
    api_key, base_url, _, model, default_image_watermark, _ = provider_runtime
    watermark = resolve_optional_model_toggle(
        model_id=model,
        category="image",
        capability_key="supports_watermark_toggle",
        requested_value=req.watermark,
        default_value=default_image_watermark,
    )

    results: list[BatchGenerateResult] = []
    for sid in req.subject_ids:
        try:
            subject = await _get_subject(project_id, sid, db)
            normalized_generation_mode = _normalize_subject_generation_mode(req.generation_mode)
            prompt = _resolve_subject_generation_prompt(subject, None, normalized_generation_mode)
            if not prompt:
                results.append(BatchGenerateResult(subject_id=sid, success=False, error="无提示词"))
                continue

            enhanced_prompt = await append_visual_styles(prompt, [project.visual_style], user.id, db)
            style_parts = _build_subject_style_suffix(subject, normalized_generation_mode)
            if style_parts:
                enhanced_prompt = f"{enhanced_prompt}, {', '.join(style_parts)}"
            enhanced_prompt = _append_pure_white_background_suffix(enhanced_prompt, subject)

            reference_images = await _get_reference_image_urls_for_generation(
                subject.id,
                req.reference_mode,
                db,
            )
            validated = validate_image_request(
                model=model,
                size=req.size,
                aspect_ratio=req.ratio,
                resolution=req.resolution,
                count=req.resolved_count(),
                reference_images=reference_images,
                watermark=watermark,
            )
            reference_images = validated["reference_images"]

            urls = await image_gen_service.generate(
                prompt=enhanced_prompt,
                api_key=api_key,
                base_url=base_url,
                model=model,
                size=validated["size"],
                aspect_ratio=validated["aspect_ratio"],
                resolution=validated["resolution"],
                reference_images=reference_images,
                n=validated["count"],
                watermark=watermark,
            )
            if not urls:
                results.append(BatchGenerateResult(subject_id=sid, success=False, error="未返回结果"))
                continue

            existing = await db.execute(select(SubjectImage).where(SubjectImage.subject_id == subject.id))
            has_existing = existing.scalars().first() is not None

            first_persisted_url = None
            for index, remote_url in enumerate(urls):
                persisted_url = await persist_remote_file(
                    remote_url,
                    f"subjects/{project_id}",
                    fallback_extension=".png",
                )
                await _create_candidate_image_and_asset(
                    user_id=user.id,
                    project_id=project_id,
                    subject=subject,
                    image_url=persisted_url,
                    prompt=enhanced_prompt,
                    model=model,
                    size=validated["size"],
                    is_primary=not has_existing and index == 0,
                    watermark=watermark,
                    ratio=validated["aspect_ratio"],
                    resolution=validated["resolution"],
                    generation_mode=normalized_generation_mode,
                    reference_mode=req.reference_mode,
                    db=db,
                )
                if first_persisted_url is None:
                    first_persisted_url = persisted_url
                    if not has_existing:
                        subject.image_url = persisted_url

            results.append(BatchGenerateResult(subject_id=sid, success=True, image_url=first_persisted_url))
        except HTTPException as e:
            results.append(BatchGenerateResult(subject_id=sid, success=False, error=e.detail))
        except Exception as e:
            results.append(BatchGenerateResult(subject_id=sid, success=False, error=str(e)))

    await db.commit()
    return results


# --- 跨集复用 ---

class DuplicateRequest(BaseModel):
    target_episode_id: str | None = None
    as_global: bool = False


@router.post(
    "/{subject_id}/duplicate",
    response_model=SubjectResponse,
    summary="复制主体",
    description="复制一个主体到目标分集或复制为全局主体，并同步复制其候选图记录。",
    response_description="复制后的主体。",
)
async def duplicate_subject(
    project_id: str,
    subject_id: str,
    req: DuplicateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user, db)
    source = await _get_subject(project_id, subject_id, db)

    new_subject = Subject(
        project_id=source.project_id,
        episode_id=UUID(req.target_episode_id) if req.target_episode_id else None,
        type=source.type,
        name=source.name,
        role=source.role,
        description=source.description,
        appearance=source.appearance,
        personality=source.personality,
        prompt=source.prompt,
        image_url=source.image_url,
        is_global=req.as_global,
        age=source.age,
        gender=source.gender,
        background=source.background,
        scene_type=source.scene_type,
        time_setting=source.time_setting,
        atmosphere=source.atmosphere,
        importance=source.importance,
        voice_id=source.voice_id,
        owner_subject_id=source.owner_subject_id,
    )
    db.add(new_subject)
    await db.commit()
    await db.refresh(new_subject)

    # 复制候选图
    img_result = await db.execute(
        select(SubjectImage).where(SubjectImage.subject_id == source.id)
    )
    for src_img in img_result.scalars().all():
        new_img = SubjectImage(
            subject_id=new_subject.id,
            image_url=src_img.image_url,
            is_primary=src_img.is_primary,
            prompt=src_img.prompt,
            model=src_img.model,
            size=src_img.size,
        )
        db.add(new_img)

    await db.commit()
    return await _to_response(new_subject, db)
