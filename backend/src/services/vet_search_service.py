"""
Nearby veterinary clinics from OpenStreetMap via the public Overpass API.

Uses tags `amenity=veterinary` and `healthcare=veterinary`. Respect Overpass
usage: keep queries small, identify with User-Agent, do not hammer the service.
@see https://wiki.openstreetmap.org/wiki/Overpass_API
"""

from __future__ import annotations

import logging
import math
import os
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx

logger = logging.getLogger(__name__)

OVERPASS_INTERPRETER = "https://overpass-api.de/api/interpreter"
DEFAULT_USER_AGENT = "MaweshiAI/1.0 (+https://github.com/) livestock vet search"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _element_lat_lon(el: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    lat, lon = el.get("lat"), el.get("lon")
    if lat is not None and lon is not None:
        return float(lat), float(lon)
    center = el.get("center")
    if isinstance(center, dict):
        clat, clon = center.get("lat"), center.get("lon")
        if clat is not None and clon is not None:
            return float(clat), float(clon)
    return None


def _tags_address(tags: Dict[str, Any]) -> str:
    if not tags:
        return ""
    full = tags.get("addr:full")
    if full:
        return str(full).strip()[:220]
    parts: list[str] = []
    num = tags.get("addr:housenumber")
    street = tags.get("addr:street")
    if street:
        line = f"{num} {street}".strip() if num else str(street).strip()
        if line:
            parts.append(line)
    for key in ("addr:suburb", "addr:village", "addr:city", "addr:district", "addr:state"):
        v = tags.get(key)
        if v:
            parts.append(str(v).strip())
    pc = tags.get("addr:postcode")
    if pc and parts:
        parts.append(str(pc).strip())
    elif pc:
        parts.append(str(pc).strip())
    out = ", ".join(parts)
    if out:
        return out[:220]
    place = tags.get("addr:place")
    return str(place).strip()[:220] if place else ""


def _osm_browse_url(el: Dict[str, Any]) -> str:
    t = str(el.get("type", "node"))
    eid = el.get("id")
    if eid is None:
        return "https://www.openstreetmap.org/"
    if t == "node":
        return f"https://www.openstreetmap.org/node/{eid}"
    if t == "way":
        return f"https://www.openstreetmap.org/way/{eid}"
    if t == "relation":
        return f"https://www.openstreetmap.org/relation/{eid}"
    return "https://www.openstreetmap.org/"


def search_vets_osm(lat: float, lng: float, radius_km: float) -> List[Dict[str, Any]]:
    """
    Returns list of dicts with keys: name, distanceKm, address, mapUrl
    (camelCase for the web client).
    """
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError("Invalid coordinates")

    radius_km = max(1.0, min(50.0, float(radius_km)))
    radius_m = int(radius_km * 1000)

    query = f"""[out:json][timeout:25];
(
  node["amenity"="veterinary"](around:{radius_m},{lat},{lng});
  way["amenity"="veterinary"](around:{radius_m},{lat},{lng});
  node["healthcare"="veterinary"](around:{radius_m},{lat},{lng});
  way["healthcare"="veterinary"](around:{radius_m},{lat},{lng});
);
out center;
"""

    ua = os.getenv("OVERPASS_USER_AGENT", DEFAULT_USER_AGENT).strip() or DEFAULT_USER_AGENT

    with httpx.Client(timeout=35.0) as client:
        res = client.post(
            OVERPASS_INTERPRETER,
            data={"data": query},
            headers={"User-Agent": ua},
        )
        res.raise_for_status()
        payload = res.json()

    elements = payload.get("elements")
    if not isinstance(elements, list):
        logger.warning("Unexpected Overpass payload shape")
        return []

    seen: Set[Tuple[str, int]] = set()
    rows: List[Dict[str, Any]] = []

    for el in elements:
        if not isinstance(el, dict):
            continue
        etype = el.get("type")
        eid = el.get("id")
        if etype not in ("node", "way", "relation") or not isinstance(eid, int):
            continue
        key = (str(etype), eid)
        if key in seen:
            continue
        coords = _element_lat_lon(el)
        if coords is None:
            continue
        seen.add(key)
        plat, plon = coords
        tags = el.get("tags") if isinstance(el.get("tags"), dict) else {}
        name = (tags.get("name") if tags else None) or "Veterinary clinic"
        if not isinstance(name, str):
            name = str(name)
        name = name.strip() or "Veterinary clinic"
        address = _tags_address(tags) if tags else ""
        dist = round(_haversine_km(lat, lng, plat, plon), 2)
        rows.append(
            {
                "name": name[:160],
                "distanceKm": dist,
                "address": address or "Address not listed in OpenStreetMap",
                "mapUrl": _osm_browse_url(el),
            }
        )

    rows.sort(key=lambda r: float(r["distanceKm"]))
    return rows[:40]
