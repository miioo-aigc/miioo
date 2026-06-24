import uuid
from dataclasses import dataclass
from pathlib import Path

from app.services.media_storage import (
    build_upload_url,
    resolve_upload_dir,
    resolve_upload_path,
)

CARD_SQUARE_VARIANT = "card_square"
CARD_LANDSCAPE_VARIANT = "card_landscape"
PREVIEW_CONTAIN_VARIANT = "preview_contain"
DERIVED_IMAGE_FORMAT = "avif"

_CARD_VARIANT_SIZES = {
    CARD_SQUARE_VARIANT: (256, 256),
    CARD_LANDSCAPE_VARIANT: (600, 400),
}
_PREVIEW_MAX_EDGE = 1600


@dataclass
class ImageDerivativeResult:
    url: str
    variant: str
    format: str
    width: int
    height: int


def _load_pillow_image_modules():
    try:
        from PIL import Image, ImageOps
        import pillow_avif  # noqa: F401
    except ImportError as exc:
        raise RuntimeError("缺少 AVIF 图片处理依赖，请安装 Pillow 与 pillow-avif-plugin") from exc
    return Image, ImageOps


def _resolve_variant_size(variant: str) -> tuple[int, int]:
    try:
        return _CARD_VARIANT_SIZES[variant]
    except KeyError as exc:
        raise ValueError(f"不支持的图片派生规格: {variant}") from exc


def _build_output_path(source_path: Path, *, subdir: str, variant: str) -> tuple[Path, str]:
    filename = f"{source_path.stem}-{variant}-{uuid.uuid4().hex}.avif"
    output_dir = resolve_upload_dir(subdir)
    output_path = output_dir / filename
    output_url = build_upload_url(subdir, filename)
    return output_path, output_url


def generate_image_derivative(
    source_url: str,
    *,
    output_subdir: str,
    variant: str,
) -> ImageDerivativeResult:
    if not source_url:
        raise ValueError("缺少原始图片地址")

    Image, ImageOps = _load_pillow_image_modules()
    source_path = resolve_upload_path(source_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"原始图片不存在: {source_url}")

    target_width, target_height = _resolve_variant_size(variant)
    output_path, output_url = _build_output_path(source_path, subdir=output_subdir, variant=variant)

    with Image.open(source_path) as image:
        converted = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        fitted = ImageOps.fit(
            converted,
            (target_width, target_height),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        fitted.save(
            output_path,
            format="AVIF",
            quality=55,
            speed=6,
        )

    return ImageDerivativeResult(
        url=output_url,
        variant=variant,
        format=DERIVED_IMAGE_FORMAT,
        width=target_width,
        height=target_height,
    )


def generate_asset_card_thumbnail(source_url: str, *, asset_type: str) -> ImageDerivativeResult:
    variant = CARD_LANDSCAPE_VARIANT if asset_type == "video" else CARD_SQUARE_VARIANT
    return generate_image_derivative(
        source_url,
        output_subdir=f"derived/assets/{variant}",
        variant=variant,
    )


def generate_asset_preview_image(source_url: str, *, output_subdir: str) -> ImageDerivativeResult:
    if not source_url:
        raise ValueError("缺少原始图片地址")

    Image = _load_pillow_image_modules()[0]
    source_path = resolve_upload_path(source_url)
    if not source_path.exists() or not source_path.is_file():
        raise FileNotFoundError(f"原始图片不存在: {source_url}")

    output_path, output_url = _build_output_path(
        source_path,
        subdir=output_subdir,
        variant=PREVIEW_CONTAIN_VARIANT,
    )

    with Image.open(source_path) as image:
        converted = image.convert("RGBA") if "A" in image.getbands() else image.convert("RGB")
        preview = converted.copy()
        preview.thumbnail((_PREVIEW_MAX_EDGE, _PREVIEW_MAX_EDGE), Image.Resampling.LANCZOS)
        width, height = preview.size
        preview.save(
            output_path,
            format="AVIF",
            quality=65,
            speed=6,
        )

    return ImageDerivativeResult(
        url=output_url,
        variant=PREVIEW_CONTAIN_VARIANT,
        format=DERIVED_IMAGE_FORMAT,
        width=width,
        height=height,
    )


def generate_project_cover_thumbnail(source_url: str, *, user_id: str) -> ImageDerivativeResult:
    return generate_image_derivative(
        source_url,
        output_subdir=f"projects/{user_id}/covers/derived",
        variant=CARD_LANDSCAPE_VARIANT,
    )


def build_derivative_metadata(derived: ImageDerivativeResult) -> dict:
    return {
        "thumbnail_variant": derived.variant,
        "thumbnail_format": derived.format,
        "thumbnail_width": derived.width,
        "thumbnail_height": derived.height,
    }
