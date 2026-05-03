from datetime import datetime, timedelta, timezone
from src.db.connection import supabase


def save_outbreak_report(data: dict):
    report = {
        "animal_type": data["animal_type"],
        "symptom_group": data["symptom_group"],
        "possible_condition": data.get("possible_condition"),
        "severity": data.get("severity"),
        "location_name": data.get("location_name"),
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "language": data.get("language", "english"),
    }
    result = supabase.table("outbreak_reports").insert(report).execute()

    alert_status = check_and_create_alert(
        data["animal_type"],
        data["symptom_group"],
        data.get("location_name", "")
    )

    return {"report": result.data, "alert_status": alert_status}


def check_and_create_alert(animal_type: str, symptom_group: str, location_name: str):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    cutoff_str = cutoff.isoformat()

    result = supabase.table("outbreak_reports") \
        .select("*") \
        .eq("animal_type", animal_type) \
        .eq("location_name", location_name) \
        .gte("created_at", cutoff_str) \
        .execute()

    all_cases = result.data

    # strip whitespace from each symptom keyword
    symptom_keywords = set(k.strip().lower() for k in symptom_group.split(","))

    matched_cases = []
    for case in all_cases:
        case_keywords = set(k.strip().lower() for k in case["symptom_group"].split(","))
        if symptom_keywords & case_keywords:
            matched_cases.append(case)

    case_count = len(matched_cases)

    if case_count >= 2:
        risk_level = "confirmed" if case_count >= 10 else "likely" if case_count >= 7 else "possible"

        # check if alert already exists
        existing = supabase.table("outbreak_alerts") \
            .select("id") \
            .eq("animal_type", animal_type) \
            .eq("location_name", location_name) \
            .execute()

        if existing.data:
            # update existing alert
            supabase.table("outbreak_alerts") \
                .update({"case_count": case_count, "risk_level": risk_level}) \
                .eq("animal_type", animal_type) \
                .eq("location_name", location_name) \
                .execute()
            return {"alert_created": False, "alert_updated": True, "risk_level": risk_level, "case_count": case_count}

        # create new alert
        alert = {
            "animal_type": animal_type,
            "symptom_group": symptom_group,
            "location_name": location_name,
            "case_count": case_count,
            "risk_level": risk_level,
        }
        supabase.table("outbreak_alerts").insert(alert).execute()
        return {"alert_created": True, "risk_level": risk_level, "case_count": case_count}

    return {"alert_created": False, "case_count": case_count}