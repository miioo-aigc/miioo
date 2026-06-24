from io import BytesIO


MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024
MAX_AVATAR_OUTPUT_BYTES = 512 * 1024
MAX_AVATAR_DIMENSION = 1024
DEFAULT_AVATAR_QUALITY = 82
MIN_AVATAR_QUALITY = 52
AVATAR_OUTPUT_EXTENSION = ".webp"
AVATAR_OUTPUT_CONTENT_TYPE = "image/webp"


class AvatarUploadError(ValueError):
    """Raised when the uploaded avatar cannot be processed safely."""


def _load_pillow_modules():
    try:
        from PIL import Image, ImageOps, UnidentifiedImageError
    except ImportError as exc:
        raise RuntimeError("缺少头像图片处理依赖，请安装 Pillow") from exc
    try:
        import pillow_avif  # noqa: F401
    except ImportError:
        # AVIF 插件缺失时仍允许处理常规 JPG/PNG/WebP 头像。
        pass
    return Image, ImageOps, UnidentifiedImageError


def _is_animated(image) -> bool:
    return bool(getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) > 1)


def _save_webp(image, *, quality: int) -> bytes:
    buffer = BytesIO()
    image.save(
        buffer,
        format="WEBP",
        quality=quality,
        method=6,
    )
    return buffer.getvalue()


def compress_avatar_image(content: bytes) -> bytes:
    if not content:
        raise AvatarUploadError("头像文件不能为空")
    if len(content) > MAX_AVATAR_SOURCE_BYTES:
        raise AvatarUploadError("头像原图不能超过 10MB")

    Image, ImageOps, UnidentifiedImageError = _load_pillow_modules()

    try:
        with Image.open(BytesIO(content)) as source:
            if _is_animated(source):
                raise AvatarUploadError("头像暂不支持动态图片，请上传静态 JPG、PNG、WebP 或 AVIF")

            normalized = ImageOps.exif_transpose(source)
            if normalized.mode not in {"RGB", "RGBA"}:
                normalized = normalized.convert("RGBA" if "A" in normalized.getbands() else "RGB")

            image = normalized.copy()
    except UnidentifiedImageError as exc:
        raise AvatarUploadError("无法识别头像图片格式") from exc
    except OSError as exc:
        raise AvatarUploadError("头像图片处理失败，请更换图片后重试") from exc

    width, height = image.size
    longest_edge = max(width, height)
    if longest_edge > MAX_AVATAR_DIMENSION:
        ratio = MAX_AVATAR_DIMENSION / float(longest_edge)
        target_size = (
            max(1, int(width * ratio)),
            max(1, int(height * ratio)),
        )
        image = image.resize(target_size, Image.Resampling.LANCZOS)

    attempt = image
    quality = DEFAULT_AVATAR_QUALITY

    while True:
        output = _save_webp(attempt, quality=quality)
        if len(output) <= MAX_AVATAR_OUTPUT_BYTES:
            return output

        can_reduce_quality = quality > MIN_AVATAR_QUALITY
        can_reduce_size = max(attempt.size) > 512

        if not can_reduce_quality and not can_reduce_size:
            return output

        if can_reduce_quality:
            quality = max(MIN_AVATAR_QUALITY, quality - 8)
            continue

        next_size = (
            max(1, int(attempt.size[0] * 0.85)),
            max(1, int(attempt.size[1] * 0.85)),
        )
        attempt = attempt.resize(next_size, Image.Resampling.LANCZOS)
