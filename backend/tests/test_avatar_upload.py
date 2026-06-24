from io import BytesIO

import pytest
from PIL import Image

from app.services.avatar_upload import (
    MAX_AVATAR_DIMENSION,
    MAX_AVATAR_OUTPUT_BYTES,
    AvatarUploadError,
    compress_avatar_image,
)


def _build_image_bytes(
    *,
    size: tuple[int, int],
    image_format: str,
    color: tuple[int, ...],
    save_kwargs: dict | None = None,
) -> bytes:
    image = Image.new("RGBA" if len(color) == 4 else "RGB", size, color)
    buffer = BytesIO()
    image.save(buffer, format=image_format, **(save_kwargs or {}))
    return buffer.getvalue()


def test_compress_avatar_image_converts_large_png_to_webp():
    raw = _build_image_bytes(
        size=(2400, 1800),
        image_format="PNG",
        color=(12, 180, 220, 255),
    )

    compressed = compress_avatar_image(raw)

    assert len(compressed) <= MAX_AVATAR_OUTPUT_BYTES

    with Image.open(BytesIO(compressed)) as image:
        assert image.format == "WEBP"
        assert max(image.size) <= MAX_AVATAR_DIMENSION


def test_compress_avatar_image_rejects_animated_gif():
    frame_a = Image.new("RGB", (128, 128), (255, 0, 0))
    frame_b = Image.new("RGB", (128, 128), (0, 0, 255))
    buffer = BytesIO()
    frame_a.save(
        buffer,
        format="GIF",
        save_all=True,
        append_images=[frame_b],
        duration=100,
        loop=0,
    )

    with pytest.raises(AvatarUploadError, match="动态图片"):
        compress_avatar_image(buffer.getvalue())
