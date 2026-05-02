from fastapi import UploadFile, HTTPException
from src.config import get_settings
import base64
import io

settings = get_settings()


async def validate_and_read_image(file: UploadFile) -> tuple[bytes, str]:
    """
    Validates content-type and file size.
    Returns (raw_bytes, content_type).
    Raises HTTPException on failure.
    """
    if file.content_type not in settings.allowed_image_types_list:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type '{file.content_type}'. "
                   f"Accepted: {', '.join(settings.allowed_image_types_list)}",
        )

    content = await file.read()
    max_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds {settings.MAX_IMAGE_SIZE_MB} MB limit.",
        )

    return content, file.content_type


def to_base64(raw: bytes) -> str:
    """Convert raw image bytes to a base64 string (for vision model APIs)."""
    return base64.b64encode(raw).decode("utf-8")
