import os
import requests
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"


# -------------------------------
# 🔹 Symptom Extraction
# -------------------------------
def extract_symptoms(text: str):
    if not text:
        return []

    text = text.lower()
    symptoms = []

    # Image + general keywords
    if any(w in text for w in ["lesion", "wound", "raw", "inflamed"]):
        symptoms.append("skin lesions")

    if any(w in text for w in ["hair loss", "alopecia"]):
        symptoms.append("hair loss")

    if any(w in text for w in ["peeling", "sloughing"]):
        symptoms.append("skin peeling")

    if any(w in text for w in ["crust", "thickened"]):
        symptoms.append("skin thickening")

    if any(w in text for w in ["infection", "infected"]):
        symptoms.append("possible infection")

    if any(w in text for w in ["distress", "weak", "sick"]):
        symptoms.append("general weakness")

    if any(w in text for w in ["mouth", "tongue", "blister"]):
        symptoms.append("mouth issue")

    if "eye" in text:
        symptoms.append("eye infection")

    if any(w in text for w in ["limp", "leg", "unable to walk"]):
        symptoms.append("limping")

    # 🔥 USER-REPORTED ONLY (non-visible)
    if "fever" in text:
        symptoms.append("fever")

    if any(w in text for w in ["not eating", "loss of appetite"]):
        symptoms.append("not eating")

    if "skin" in text:
        symptoms.append("skin issue")

    return list(set(symptoms))


# -------------------------------
# 🔹 Severity (for combined reasoning)
# -------------------------------
def classify_severity(symptoms):
    if len(symptoms) >= 4:
        return "high"
    elif len(symptoms) >= 2:
        return "moderate"
    else:
        return "low"


# -------------------------------
# 🔹 Condition Suggestions
# -------------------------------
def suggest_conditions(symptoms):
    conditions = []

    if "mouth issue" in symptoms and "possible infection" in symptoms:
        conditions.append("Foot and Mouth Disease (FMD) risk")

    if "skin lesions" in symptoms and "hair loss" in symptoms:
        conditions.append("Mange or skin infection")

    if "skin peeling" in symptoms:
        conditions.append("Severe dermatological condition")

    if "fever" in symptoms:
        conditions.append("Possible infection or systemic illness")

    if not conditions:
        conditions.append("General health issue - further assessment needed")

    return conditions


# -------------------------------
# 🔹 Recommended Actions
# -------------------------------
def suggest_actions(severity, symptoms):
    actions = []

    if severity == "high":
        actions.append("Isolate the animal immediately")
        actions.append("Contact a veterinarian urgently")

    if "skin lesions" in symptoms:
        actions.append("Keep affected area clean and dry")

    if "possible infection" in symptoms:
        actions.append("Monitor for infection worsening")

    if "mouth issue" in symptoms:
        actions.append("Provide soft food and clean water")

    if "fever" in symptoms:
        actions.append("Monitor temperature and keep animal hydrated")

    if not actions:
        actions.append("Monitor the animal and consult a vet if condition worsens")

    return actions


# -------------------------------
# 🔹 Main Function
# -------------------------------
def analyze_image(image_bytes: bytes, user_text: str = None):
    try:
        if not GEMINI_API_KEY:
            return {
                "visibleSymptoms": [],
                "reportedSymptoms": [],
                "confidence": 0.1,
                "imageSummary": "Missing API key",
                "warning": "GEMINI_API_KEY not set"
            }

        # Convert image → base64
        img_base64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"""
Analyze this animal image.

User-described symptoms: {user_text if user_text else "No symptoms provided"}

Focus ONLY on visible signs from the image.
Do not assume diseases.
"""
                        },
                        {
                            "inlineData": {
                                "mimeType": "image/png",
                                "data": img_base64
                            }
                        }
                    ]
                }
            ]
        }

        response = requests.post(API_URL, json=payload, timeout=30)

        if response.status_code != 200:
            return {
                "visibleSymptoms": [],
                "reportedSymptoms": [],
                "confidence": 0.2,
                "imageSummary": "Vision model failed",
                "warning": "External API error"
            }

        result = response.json()
        caption = result["candidates"][0]["content"]["parts"][0]["text"]

        # -------------------------------
        # 🔹 Separate extraction
        # -------------------------------
        image_symptoms = extract_symptoms(caption)
        reported_symptoms = extract_symptoms(user_text)

        # 🔹 Combined ONLY for reasoning
        combined_symptoms = list(set(image_symptoms + reported_symptoms))

        severity = classify_severity(combined_symptoms)
        conditions = suggest_conditions(combined_symptoms)
        actions = suggest_actions(severity, combined_symptoms)

        confidence = min(0.5 + 0.1 * len(combined_symptoms), 0.9)

        warning = None if combined_symptoms else "No clear symptoms detected"

        return {
            # ✅ CLEAN SEPARATION
            "visibleSymptoms": image_symptoms,
            "reportedSymptoms": reported_symptoms,

            # 👇 derived from combined reasoning
            "severity": severity,
            "possibleConditions": conditions,
            "recommendedActions": actions,

            "confidence": confidence,
            "imageSummary": caption,
            "warning": warning
        }

    except Exception as e:
        return {
            "visibleSymptoms": [],
            "reportedSymptoms": [],
            "confidence": 0.1,
            "imageSummary": "Processing failed",
            "warning": str(e)
        }