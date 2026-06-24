import io
import os
import tempfile
from dataclasses import dataclass

from fastapi import HTTPException, UploadFile


MAX_SCRIPT_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_SCRIPT_EXTENSIONS = {".txt", ".md", ".markdown", ".doc", ".docx", ".pdf"}


@dataclass
class ParsedScriptFile:
    filename: str
    extension: str
    raw_text: str
    cleaned_text: str


def get_script_file_extension(filename: str) -> str:
    return "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _decode_text(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="文本文件编码无法识别，请使用 UTF-8 编码") from exc


def _normalize_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()


def _extract_doc_text(content: bytes) -> str:
    try:
        from doc2txt import extract_text
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="服务端缺少 .doc 解析依赖，请安装 doc2txt") from exc

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".doc") as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        return extract_text(temp_path, optimize_format=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="DOC 文件解析失败，请确认文件未损坏并重试") from exc
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                pass


def parse_script_bytes(content: bytes, filename: str) -> ParsedScriptFile:
    if len(content) > MAX_SCRIPT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 20MB")

    extension = get_script_file_extension(filename)
    if extension not in ALLOWED_SCRIPT_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {extension or 'unknown'}")

    if extension in {".txt", ".md", ".markdown"}:
        raw_text = _decode_text(content)
    elif extension == ".doc":
        raw_text = _extract_doc_text(content)
    elif extension == ".docx":
        from docx import Document

        document = Document(io.BytesIO(content))
        paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
        raw_text = "\n\n".join(paragraphs)
    elif extension == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        pages = []
        for page in reader.pages:
            extracted = page.extract_text() or ""
            if extracted.strip():
                pages.append(extracted.strip())
        raw_text = "\n\n".join(pages)
    else:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {extension}")

    cleaned_text = _normalize_text(raw_text)
    if not cleaned_text:
        if extension == ".pdf":
            raise HTTPException(status_code=400, detail="PDF 未提取到可用文本，暂不支持扫描版 OCR")
        raise HTTPException(status_code=400, detail="文件内容为空")

    return ParsedScriptFile(
        filename=filename,
        extension=extension,
        raw_text=raw_text,
        cleaned_text=cleaned_text,
    )


async def parse_script_upload(file: UploadFile) -> ParsedScriptFile:
    content = await file.read()
    filename = file.filename or "unknown"
    return parse_script_bytes(content, filename)
