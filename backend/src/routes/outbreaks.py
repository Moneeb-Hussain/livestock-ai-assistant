from fastapi import APIRouter
from fastapi.responses import JSONResponse
from src.schemas.outbreak import OutbreakReportRequest, OutbreakReportResponse
from src.services.outbreak_service import save_outbreak_report, detect_outbreak, list_active_alerts
from src.utils.response_format import success, error
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/outbreaks", tags=["Outbreaks"])


# ─── POST /api/outbreaks/report ───────────────────────────────────────────────

@router.post("/report")
async def report_outbreak(body: OutbreakReportRequest) -> JSONResponse:
    """
    Called when the user clicks "Report to Outbreak Map".
    1. Saves the outbreak report
    2. Runs detection — if threshold reached, creates an alert
    Returns whether an alert was triggered.
    """
    try:
        report_id = await save_outbreak_report(body)

        alert = await detect_outbreak(
            animal_type=body.animal_type,
            location_name=body.location_name,
            latitude=body.latitude,
            longitude=body.longitude,
        )

        response = OutbreakReportResponse(
            report_id=report_id,
            message=(
                "Outbreak alert triggered! Authorities have been notified."
                if alert else
                "Your report has been saved. Thank you."
            ),
            alert_triggered=alert is not None,
            alert=alert,
        )
        return success(response.model_dump(mode="json"), response.message, 201)

    except Exception as exc:
        logger.error("report_outbreak failed: %s", exc, exc_info=True)
        return error("Failed to save outbreak report.", 500)


# ─── GET /api/outbreaks/alerts ────────────────────────────────────────────────

@router.get("/alerts")
async def get_active_alerts(location: str | None = None) -> JSONResponse:
    """
    Returns active outbreak alerts.
    Optionally filter by ?location=Sheikhupura
    """
    try:
        alerts = await list_active_alerts(location_name=location)
        return success(
            {"alerts": [a.model_dump(mode="json") for a in alerts], "total": len(alerts)}
        )
    except Exception as exc:
        logger.error("list_active_alerts failed: %s", exc, exc_info=True)
        return error("Failed to fetch outbreak alerts.", 500)
