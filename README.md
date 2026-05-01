# 🐄 Livestock AI Assistant — Vision Service (Person 4)

This module handles **image-based symptom extraction** for livestock.

It processes an uploaded animal image and (optionally) user-provided symptoms, then returns structured medical observations.

---

## 🚀 Features

- Image upload handling (FastAPI)
- Image → base64 conversion
- Vision model integration (AI-based image understanding)
- Symptom extraction from image
- Symptom extraction from user text
- Structured JSON response
- Error handling & fallback support

---

## 🧠 What this service does

Input:
- Animal image
- Optional user message (e.g. "My cow has fever")

Output:
- visibleSymptoms → extracted from image
- reportedSymptoms → extracted from user text
- confidence score
- imageSummary (AI description)
- warning (if any issue occurs)

---

## 📦 API Endpoint

### POST `/analyze-image`

### Request (multipart/form-data):

| Field   | Type   | Required | Description |
|--------|--------|----------|------------|
| file   | Image  | Yes      | Animal image |
| message| String | No       | User symptoms |

---

## 📤 Example Response

```json
{
  "visibleSymptoms": ["skin lesions", "hair loss"],
  "reportedSymptoms": ["fever"],
  "confidence": 0.9,
  "imageSummary": "Detected visible skin abnormalities...",
  "warning": null
}
