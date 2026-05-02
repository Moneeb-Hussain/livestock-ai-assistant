from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from src.schemas.chat import ChatRequest, ChatResponse, ChatMessage
from src.schemas.outbreak import OutbreakReportRequest
from src.services.ai_service import run_text_diagnosis
from src.services.vision_service import analyse_image
from src.services.outbreak_service import save_outbreak_report, detect_outbreak
from src.utils.response_format import success, error
from src.utils.file_upload import validate_and_read_image
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ─── POST /api/chat  ──────────────────────────────────────────────────────────

@router.post("", response_model=None)
async def chat(
    # The frontend can send multipart/form-data (image attach) OR JSON.
    # To support both we accept form fields + optional file.
    message: str = Form(...),
    animal_type: str | None = Form(None),
    language: str = Form("english"),
    location_name: str | None = Form(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    chat_history: str = Form("[]"),    # JSON-encoded list of ChatMessage
    transcript: str | None = Form(None),
    image: UploadFile | None = File(None),
) -> JSONResponse:
    # 1. Parse chat history
    try:
        history_raw = json.loads(chat_history)
        history = [ChatMessage(**m) for m in history_raw]
    except Exception as exc:
        return error(f"Invalid chat_history JSON: {exc}", 422)

    # 2. Image analysis (optional)
    image_observations: str | None = None
    if image and image.filename:
        try:
            image_bytes, content_type = await validate_and_read_image(image)
            vision_result = await analyse_image(image_bytes, content_type)
            image_observations = vision_result.get("imageSummary", "")
            logger.info("Vision analysis complete: %s", vision_result)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Vision service failed: %s", exc)
            image_observations = "Image could not be analysed at this time."

    # 3. Build request & run text diagnosis
    chat_request = ChatRequest(
        message=message,
        animal_type=animal_type,
        language=language,  # type: ignore[arg-type]
        chat_history=history,
        image_observations=image_observations,
        transcript=transcript,
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
    )

    try:
        response: ChatResponse = await run_text_diagnosis(chat_request)
    except Exception as exc:
        logger.error("AI service error: %s", exc, exc_info=True)
        return error("AI service is temporarily unavailable. Please try again.", 503)

    # 4. Auto-report outbreak for urgent/moderate cases
    outbreak_reported = False
    if response.severity in ("urgent", "moderate") and location_name:
        try:
            report = OutbreakReportRequest(
                animal_type=animal_type or "unknown",
                symptom_group=message[:200],
                possible_condition=(
                    response.possible_conditions[0]
                    if response.possible_conditions else None
                ),
                severity=response.severity,
                language=language,  # type: ignore[arg-type]
                location_name=location_name,
                latitude=latitude,
                longitude=longitude,
            )
            await save_outbreak_report(report)
            outbreak_reported = True
        except Exception as exc:
            logger.warning("Outbreak report save failed: %s", exc)

    response.outbreak_reported = outbreak_reported
    return success(response.model_dump(), "Diagnosis complete")


# ─── GET /api/chat/health  ────────────────────────────────────────────────────

@router.get("/health")
async def chat_health() -> JSONResponse:
    """Simple liveness check for the chat service."""
    return success({"status": "ok"}, "Chat service is running")
