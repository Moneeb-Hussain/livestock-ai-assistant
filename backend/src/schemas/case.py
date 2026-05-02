from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal
from src.schemas.chat import ChatMessage, TreatmentPlan


# ─── Inbound ──────────────────────────────────────────────────────────────────

class CreateCaseRequest(BaseModel):
    animal_type: str = Field(..., example="goat")
    language: Literal["english", "roman_urdu"] = "english"
    location_name: str | None = None


class UpdateCaseRequest(BaseModel):
    messages: list[ChatMessage] | None = None
    image_observations: str | None = None
    ai_response: dict | None = None
    treatment_plan: TreatmentPlan | None = None
    urgency_level: str | None = None


# ─── Outbound ─────────────────────────────────────────────────────────────────

class CaseResponse(BaseModel):
    id: str
    animal_type: str
    language: str
    location_name: str | None
    messages: list[ChatMessage]
    image_observations: str | None
    ai_response: dict | None
    treatment_plan: TreatmentPlan | None
    urgency_level: str | None
    created_at: datetime


class CaseListResponse(BaseModel):
    cases: list[CaseResponse]
    total: int
