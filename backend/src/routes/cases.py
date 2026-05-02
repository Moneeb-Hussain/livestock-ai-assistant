from fastapi import APIRouter
from fastapi.responses import JSONResponse
from src.schemas.case import CreateCaseRequest, UpdateCaseRequest
from src.services.case_service import create_case, get_case, update_case, list_cases
from src.utils.response_format import success, error
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cases", tags=["Cases"])


# ─── POST /api/cases ─────────────────────────────────────────────────────────

@router.post("")
async def create_new_case(body: CreateCaseRequest) -> JSONResponse:
    """
    Creates a new case when the user clicks New Case in the frontend.
    Returns a case object with a fresh ID.
    """
    try:
        case = await create_case(body)
        return success(case.model_dump(mode="json"), "Case created", 201)
    except Exception as exc:
        logger.error("create_case failed: %s", exc, exc_info=True)
        return error("Failed to create case.", 500)


# ─── GET /api/cases ──────────────────────────────────────────────────────────

@router.get("")
async def get_all_cases() -> JSONResponse:
    """Returns all stored cases (used by the case selector in the sidebar)."""
    try:
        cases = await list_cases()
        return success(
            {"cases": [c.model_dump(mode="json") for c in cases], "total": len(cases)}
        )
    except Exception as exc:
        logger.error("list_cases failed: %s", exc, exc_info=True)
        return error("Failed to fetch cases.", 500)


# ─── GET /api/cases/{case_id} ────────────────────────────────────────────────

@router.get("/{case_id}")
async def get_single_case(case_id: str) -> JSONResponse:
    """Returns a single case by ID."""
    try:
        case = await get_case(case_id)
        if case is None:
            return error(f"Case '{case_id}' not found.", 404)
        return success(case.model_dump(mode="json"))
    except Exception as exc:
        logger.error("get_case failed id=%s: %s", case_id, exc, exc_info=True)
        return error("Failed to fetch case.", 500)


# ─── PATCH /api/cases/{case_id} ──────────────────────────────────────────────

@router.patch("/{case_id}")
async def update_existing_case(case_id: str, body: UpdateCaseRequest) -> JSONResponse:
    """
    Updates a case after a chat round:
    - appends new messages
    - stores AI response + treatment plan
    - updates urgency level
    """
    try:
        case = await update_case(case_id, body)
        if case is None:
            return error(f"Case '{case_id}' not found.", 404)
        return success(case.model_dump(mode="json"), "Case updated")
    except Exception as exc:
        logger.error("update_case failed id=%s: %s", case_id, exc, exc_info=True)
        return error("Failed to update case.", 500)
