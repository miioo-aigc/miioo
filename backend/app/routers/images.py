import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.dependencies import get_current_user
from app.models.user import User
from app.services.media_storage import build_upload_url, resolve_upload_dir

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"}
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post(
    "/upload",
    summary="上传通用图片",
    description="上传一张通用图片并返回可访问的 `/uploads/...` 地址。常用于项目封面、二维码图片等前置上传场景。",
    response_description="上传成功后的图片访问地址。",
    responses={
        200: {
            "description": "上传成功",
            "content": {
                "application/json": {
                    "example": {
                        "url": "/uploads/images/5f6f9b7b77d2419d8f6f8a6d4d55d1c2.png",
                    }
                }
            },
        }
    },
)
async def upload_image(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、GIF、WebP、AVIF 格式")

    filename = file.filename or "image.png"
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ".png"
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="不支持的文件格式")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 5MB")

    upload_dir = resolve_upload_dir("images")

    file_id = uuid.uuid4().hex
    file_path = upload_dir / f"{file_id}{ext}"
    file_path.write_bytes(content)

    url = build_upload_url("images", f"{file_id}{ext}")
    return {"url": url}
