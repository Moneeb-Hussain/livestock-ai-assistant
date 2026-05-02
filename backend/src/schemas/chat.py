from pydantic import BaseModel, Field
from typing import Literal


# ─── Inbound ──────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    animal_type: str | None = Field(None, example="goat")
    language: Literal["english", "roman_urdu"] = "english"
    chat_history: list[ChatMessage] = []
    image_observations: str | None = None   # filled by Hamza's vision service
    transcript: str | None = None           # filled by Afshan's audio service
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None


# ─── Outbound ─────────────────────────────────────────────────────────────────

class TreatmentPlan(BaseModel):
    immediate_care: list[str] = []
    medicines_supportive_care: list[str] = []
    when_to_call_vet: str = ""
    follow_up_reminders: list[str] = []


class ChatResponse(BaseModel):
    severity: Literal["urgent", "moderate", "low", "unknown"] = "unknown"
    possible_conditions: list[str] = []
    chat_reply: str
    care_steps: list[str] = []
    treatment_plan: TreatmentPlan | None = None
    follow_up_questions: list[str] = []
    disclaimer: str = (
        "MaweshiAI provides general guidance only and does not replace "
        "professional veterinary advice. Please consult a licensed veterinarian "
        "for serious cases."
    )
    outbreak_reported: bool = False
