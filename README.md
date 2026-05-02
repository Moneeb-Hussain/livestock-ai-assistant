# 🐄 Livestock Vision Service

This service performs **strict visual analysis of animal images** and returns structured observations for downstream processing.

It is designed as a **low-level perception module** in a livestock health pipeline.

---

## 🚀 Features

- Image upload handling (FastAPI)
- Vision model integration (Gemini)
- Strict visible symptom extraction (no hallucination)
- Structured JSON output (fixed schema)
- Input validation (file type, size)
- Output sanitization (type-safe, filtered)
- Robust error handling with safe fallbacks

---

## 🧠 What this service does

### Input
- Animal image (required)

### Output (STRICT FORMAT)

```json
{
  "visibleSymptoms": ["..."],
  "confidence": 0.0,
  "imageSummary": "...",
  "warning": null
}
```
### Example JSON Response
```
{
  "visibleSymptoms": [
    "patches of hair loss",
    "reddened skin areas",
    "crusted lesions"
  ],
  "confidence": 0.72,
  "imageSummary": "A brown livestock animal is shown from the side with multiple visible skin abnormalities. Several areas of hair loss expose reddened skin, and crusted lesions are scattered across the torso. The animal appears under natural lighting with a partially visible background.",
  "warning": "Partial visibility of animal"
}

