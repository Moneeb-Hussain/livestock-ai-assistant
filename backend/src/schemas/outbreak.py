from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal


# ─── Inbound ──────────────────────────────────────────────────────────────────

class OutbreakReportRequest(BaseModel):
    animal_type: str = Field(..., example="goat")
    disease_group: str | None = Field(None, example="FMD")
    symptom_group: str | None = Field(None, example="fever,blisters,not eating")
    possible_condition: str | None = None
    severity: Literal["urgent", "moderate", "low", "unknown"] = "unknown"
    language: Literal["english", "roman_urdu"] = "english"
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# ─── Outbound ─────────────────────────────────────────────────────────────────

class OutbreakAlertResponse(BaseModel):
    id: str
    location_name: str
    animal_type: str
    symptom_group: str | None
    case_count: int
    risk_level: Literal["low", "moderate", "high", "critical"]
    created_at: datetime


class OutbreakReportResponse(BaseModel):
    report_id: str
    message: str
    alert_triggered: bool
    alert: OutbreakAlertResponse | None = None


class OutbreakListResponse(BaseModel):
    alerts: list[OutbreakAlertResponse]
    total: int
