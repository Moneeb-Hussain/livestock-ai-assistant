from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Any
import logging

logger = logging.getLogger(__name__)


def success(data: Any, message: str = "OK", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "message": message, "data": data},
    )


def error(message: str, status_code: int = 400, details: Any = None) -> JSONResponse:
    payload: dict[str, Any] = {"success": False, "message": message}
    if details is not None:
        payload["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.warning("Validation error on %s: %s", request.url, exc)
    return error("Invalid request payload.", 422, str(exc))


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return error("An unexpected error occurred. Please try again.", 500)