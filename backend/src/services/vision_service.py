import os
import requests
import base64
import json
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
)

ALLOWED_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

ALLOWED_WARNINGS = {
    "Low confidence — interpret cautiously",
    "Poor image quality",
    "Partial visibility of animal",
}

PROMPT = """
You are a strict veterinary vision system.

Return ONLY valid JSON:

{
  "isAnimalPresent": true/false,
  "visibleSymptoms": ["..."],
  "confidence": 0.0-1.0,
  "imageSummary": "...",
  "warning": null or "..."
}

STRICT RULES:

1. isAnimalPresent
   - true ONLY if a real animal body (head, limbs, torso, or clear body part) is visible
   - false if image contains objects, humans only, drawings, or unclear shapes

2. visibleSymptoms
   - Include ONLY directly observable physical features
   - Allowed: color changes, swelling, wounds, scabs, lesions, discharge, posture, hair loss
   - NOT allowed: infection, disease, parasite, virus, syndrome
   - Do NOT infer anatomy beyond what is visually obvious
     (e.g., say "udder area" instead of specific anatomical terms if unsure)
   - Do NOT interpret causes or severity
   - Prefer simple visual phrases:
     e.g., "red patches", "raised bumps", "hair loss", "dark crust"
   - If no symptoms visible → []
   - If no animal → null

3. confidence
   - Reflect visual certainty ONLY (not medical certainty)
   - Scale:
       0.0 → no useful information
       0.3 → very unclear / poor visibility
       0.5 → moderate clarity
       0.7 → clear visible features
       0.8 → very clear and unambiguous
   - HARD LIMIT: never exceed 0.85
   - If partial visibility OR cropped/multi-panel image → MUST be ≤ 0.75
   - If multiple scenes or mixed subjects → reduce confidence

4. imageSummary
   - MUST be 2–4 complete sentences (minimum 30 words)
   - MUST describe ONLY visible physical details
   - MUST NOT include diagnosis, interpretation, or assumptions
   - MUST NOT include meta phrases like:
       "this image shows", "depicts", "appears to be"
   - MUST be grammatically complete (no truncation)
   - Avoid vague words like "condition", "issue", "abnormal"
   - If multiple panels or regions exist → describe each briefly and separately
   - Mention if human hands or non-animal elements are present

5. warning
   - Use ONLY one of:
       "Low confidence — interpret cautiously"
       "Poor image quality"
       "Partial visibility of animal"
       null
   - If confidence < 0.4 → MUST use low confidence warning
   - If image is cropped, multi-panel, or incomplete → use "Partial visibility of animal"
   - If image is blurry → use "Poor image quality"

GLOBAL RULES:
- Do NOT hallucinate
- Do NOT guess
- Do NOT interpret
- Do NOT output anything except valid JSON
- Ensure JSON is complete and valid before returning
"""

# -------------------------------
# Extract first valid JSON object
# -------------------------------
def extract_json(text: str) -> str | None:
    """
    Scans for the first valid JSON object using Python's own decoder.
    Immune to: nested braces, multiple JSON blocks, trailing text, markdown fences.
    """
    decoder = json.JSONDecoder()
    text = text.strip()

    for i, char in enumerate(text):
        if char == "{":
            try:
                obj, _ = decoder.raw_decode(text, i)
                return json.dumps(obj)
            except json.JSONDecodeError:
                continue

    return None


# -------------------------------
# Validate image before sending
# -------------------------------
def validate_image(image_bytes: bytes, mime_type: str) -> str | None:
    if not image_bytes:
        return "Empty file"
    if mime_type not in ALLOWED_TYPES:
        return f"Unsupported file type: {mime_type}"
    if len(image_bytes) > MAX_IMAGE_SIZE:
        return "File too large (max 5MB allowed)"
    return None


# -------------------------------
# Main function
# -------------------------------
def analyze_image(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    try:
        # Normalize mime_type — handle None or non-string input
        if not isinstance(mime_type, str) or not mime_type:
            mime_type = "image/png"

        # Guard: API key
        if not GEMINI_API_KEY:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "Server configuration error — API key is missing.",
                "warning": "Missing API key",
            }

        # Guard: image validation — invalid mime or size returns early with user feedback
        error = validate_image(image_bytes, mime_type)
        if error:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": f"Image rejected during validation: {error}.",
                "warning": error,
            }

        img_base64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {"inlineData": {"mimeType": mime_type, "data": img_base64}},
                    ]
                }
            ]
        }

        # Call Gemini with 2 attempts — only 200 sets response, timeouts retry cleanly
        response = None
        for _ in range(2):
            try:
                r = requests.post(API_URL, json=payload, timeout=20)
                if r.status_code == 200:
                    response = r
                    break
            except requests.exceptions.Timeout:
                continue

        if not response:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "Vision model failed to respond after retry attempts.",
                "warning": "External API error",
            }

        # Parse Gemini response
        result = response.json()
        try:
            raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "Unexpected response structure from vision model.",
                "warning": "Malformed API response",
            }

        # Extract JSON from raw text
        clean_json = extract_json(raw_text)
        if not clean_json:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "Model returned output containing no valid JSON block.",
                "warning": "No JSON returned",
            }

        try:
            parsed = json.loads(clean_json)
        except json.JSONDecodeError:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "JSON extracted from model output could not be parsed.",
                "warning": "Malformed model response",
            }

        # Required field check
        if "isAnimalPresent" not in parsed:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "Model response was missing the required isAnimalPresent field.",
                "warning": "Missing required field",
            }

        # Hard stop: no animal
        if parsed["isAnimalPresent"] is False:
            return {
                "visibleSymptoms": None,
                "confidence": 0.0,
                "imageSummary": "No animal was detected in the submitted image.",
                "warning": "Analysis not applicable",
            }

        # Sanitize: visibleSymptoms
        symptoms = parsed.get("visibleSymptoms", [])
        if isinstance(symptoms, str):
            symptoms = [symptoms]
        if not isinstance(symptoms, list):
            symptoms = []
        banned_words = ["disease", "infection", "parasite", "virus"]
        symptoms = [
            str(s).strip() for s in symptoms
            if not any(word in str(s).lower() for word in banned_words)
        ]
        # Ordered dedupe — preserves model ordering, removes exact duplicates
        seen = set()
        symptoms = [s for s in symptoms if s and not (s in seen or seen.add(s))]
        # Cap each symptom — prevents model generating essay-length entries
        symptoms = [s[:120] for s in symptoms]

        # Sanitize: confidence
        confidence = parsed.get("confidence", 0.0)
        if not isinstance(confidence, (int, float)):
            confidence = 0.0
        confidence = round(max(0.0, min(1.0, float(confidence))), 2)

        # Sanitize: imageSummary
        summary = parsed.get("imageSummary", "")
        if not isinstance(summary, str):
            summary = ""
        summary = summary.strip()
        # Blank only on clearly broken output — prompt enforces 30 word minimum
        if len(summary.split()) < 5:
            summary = ""
        # Soft cap — prevents model returning an essay to the diagnosis service
        if len(summary) > 600:
            summary = summary[:600].rsplit(" ", 1)[0]

        # Sanitize: warning — whitelist first, then non-destructive low-confidence fallback
        warning = parsed.get("warning")
        if warning not in ALLOWED_WARNINGS:
            warning = None
        if warning is None and confidence < 0.4:
            warning = "Low confidence — interpret cautiously"

        return {
            "visibleSymptoms": symptoms,
            "confidence": confidence,
            "imageSummary": summary,
            "warning": warning,
        }

    except Exception:
        return {
            "visibleSymptoms": None,
            "confidence": 0.0,
            "imageSummary": "An unexpected error occurred during image processing.",
            "warning": "Internal processing error",
        }
