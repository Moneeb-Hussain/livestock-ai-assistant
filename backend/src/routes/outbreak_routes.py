from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from backend.src.services.outbreak_service import save_outbreak_report

router = APIRouter()


class OutbreakReportRequest(BaseModel):
    animal_type: str
    symptom_group: str
    possible_condition: Optional[str] = None
    severity: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    language: Optional[str] = "english"


@router.post("/api/outbreaks")
def report_outbreak(data: OutbreakReportRequest):
    try:
        result = save_outbreak_report(data.model_dump())
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/outbreaks")
def get_alerts():
    try:
        from backend.src.db.connection import supabase
        result = supabase.table("outbreak_alerts") \
            .select("*") \
            .order("created_at", desc=True) \
            .execute()
        return {"success": True, "alerts": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))