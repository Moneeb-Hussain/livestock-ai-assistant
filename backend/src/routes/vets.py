import logging

from fastapi import APIRouter, HTTPException, Query

from src.services.vet_search_service import search_vets_osm

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/vets")
def get_nearby_vets(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(25, ge=1, le=50),
):
    """
    OSM-backed veterinary clinics near a point (Overpass API).
    Query params match the frontend: `lat`, `lng`, optional `radius_km`.
    """
    try:
        return search_vets_osm(lat, lng, radius_km)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("Vet search failed")
        raise HTTPException(
            status_code=503,
            detail="Could not reach map data. Try again in a moment.",
        ) from e
