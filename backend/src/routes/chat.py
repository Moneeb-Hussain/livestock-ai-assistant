import json
import logging
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from src.services.ai_service import generate_livestock_response
from src.services.vision_service import analyze_image
from src.utils.response_format import success, error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

@router.post("", response_model=None)
async def chat(
    message: str = Form(...),
    chat_history: str = Form("[]"),
    image: UploadFile | None = File(None),
) -> JSONResponse:
    if not message.strip():
        return error("Message is required.", 422)

    try:
        parsed_history = parse_chat_history(chat_history)
    except ValueError as exc:
        return error(str(exc), 422)

    try:
        image_observations = await get_image_observations(image)

        ai_response = await run_in_threadpool(
            generate_livestock_response,
            message.strip(),
            image_observations,
            parsed_history,
        )

        return success(ai_response, "MaweshiAI response generated successfully")

    except Exception as exc:
        logger.error("Chat request failed: %s", exc, exc_info=True)
        # Not Render infra — any failure in AI/vision path is surfaced as JSON (check Render logs for full traceback).
        return error(
            "Chat failed on the server. Check API logs (e.g. Groq key, model, or vision config).",
            500,
            details={"error_type": type(exc).__name__},
        )

@router.get("/health")
async def chat_health() -> JSONResponse:
    return success({"status": "ok"}, "Chat service is running")

def parse_chat_history(raw_history: str) -> list[dict[str, str]]:
    try:
        history = json.loads(raw_history or "[]")
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid chat_history JSON: {exc}") from exc

    if not isinstance(history, list):
        raise ValueError("chat_history must be a JSON array.")

    parsed: list[dict[str, str]] = []

    for item in history:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role", "")).strip().lower()
        content = str(item.get("content", "")).strip()

        if role in {"user", "assistant"} and content:
            parsed.append({"role": role, "content": content})

    return parsed

async def get_image_observations(
    image: UploadFile | None,
) -> dict[str, Any] | None:
    if not image or not image.filename:
        return None

    image_bytes = await image.read()
    mime_type = image.content_type or "image/png"

    return await run_in_threadpool(
        analyze_image,
        image_bytes,
        mime_type,
    )