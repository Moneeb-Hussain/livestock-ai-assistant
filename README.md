# MaweshiAI

MaweshiAI helps farmers describe animal health problems and receive structured AI guidance. The **backend** (FastAPI under `backend/`) uses Groq for text-based livestock health reasoning and optionally Gemini for image observation when an animal image is uploaded. The **frontend** (Next.js under `frontend/`) provides chat, cases, treatment plans, and related UI.

MaweshiAI is designed for livestock such as goats, cows, buffaloes, sheep, camels, calves, lambs, and similar farm animals. It provides cautious, farmer-friendly guidance and does **not** replace a qualified veterinarian.

## Repository layout

| Path | Role |
|------|------|
| `frontend/` | Next.js (App Router) + Tailwind: chat, treatment plan, outbreak alerts, case UI, `src/lib/api` clients |
| `backend/` | FastAPI app: `/api/chat`, `/api/cases`, `/api/outbreaks`, optional `/api/vets` |
| `ai-services/` | Text / vision / audio pipelines (prompts, model clients)—integrate with or call from backend |
| `db/` | Supabase/PostgreSQL migrations and seeds (`outbreak_reports`, `outbreak_alerts`, etc.) |

## Target stack (MVP)

- **Frontend:** Next.js, Tailwind CSS, `fetch`-based API modules under `src/lib/api`
- **Backend:** Python FastAPI
- **Database:** Supabase PostgreSQL
- **AI:** Hugging Face Inference (text/vision); browser or server speech as needed
- **Maps:** Browser geolocation + OpenStreetMap / Nominatim / Overpass (vet search); optional **Leaflet** + free tile/OSM for map UI

## Backend source layout

- `backend/src/routes/` — HTTP route modules
- `backend/src/services/` — business logic (cases, outbreaks, AI orchestration)
- `backend/src/validators/` — request/response validation
- `backend/src/db/models/` — data models / DB access helpers
- `backend/src/utils/` — safety, response shaping, helpers

The application entrypoint (for example `main.py`) lives under `backend/src/`.

## Frontend (Next.js)

Next.js **requires Node.js ≥ 18.17** (recommended: **20.x**). If `next dev` exits with a Node version error, upgrade Node (for example with [nvm](https://github.com/nvm-sh/nvm): `cd frontend && nvm install && nvm use`, then `npm install && npm run dev`).

Architecture reference: [Maweshi AI App architecture](https://docs.google.com/document/d/1DQssetF3gWAMZX3xntW3tD0Y7nIHcaf9WvqzRqlI4y4/edit).

---

## Features

- FastAPI backend API
- Swagger UI documentation
- Console chatbot for local testing
- Groq-powered livestock health assistant
- Optional image analysis using Gemini
- Chat history support
- Structured JSON responses
- Medical, non-medical, and false-input response handling
- LLM response validation and retry flow
- Optional Groq request/response logging

---

## Tech Stack

- Python
- FastAPI
- Uvicorn
- Groq API
- Gemini API for optional image analysis
- python-dotenv
- python-multipart

---

## Project Structure

```text
backend/
  src/
    main.py
    routes/
      chat.py
    services/
      ai_service.py
      prompt_service.py
      vision_service.py
    config/
      prompts.json
      ai_config.json
    utils/
      response_format.py
  console_chatbot.py
  requirements.txt
  .env
```

---

## Prerequisites

Before running the project, make sure you have:

- Python 3.11+
- Git
- pip
- Groq API key
- Gemini API key, only needed for image upload testing

---

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd livestock-ai-assistant/backend
```

---

### 2. Create a Virtual Environment

#### Linux / Mac / Codespaces

```bash
python -m venv venv
source venv/bin/activate
```

#### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

---

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

Your `requirements.txt` should include:

```txt
fastapi
uvicorn
python-dotenv
python-multipart
groq
requests
```

---

### 4. Create Environment File

Create a `.env` file inside the `backend` folder:

```bash
touch .env
```

Add:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Required only for image upload testing
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
LOG_GROQ_API=true
```

---

## Run the FastAPI Server

From the `backend` folder:

```bash
uvicorn src.main:app --reload
```

The API should run at:

```text
http://127.0.0.1:8000
```

---

## API Documentation

FastAPI automatically provides Swagger UI.

Open:

```text
http://127.0.0.1:8000/docs
```

ReDoc is available at:

```text
http://127.0.0.1:8000/redoc
```

---

## API Endpoints

### Health Check

```http
GET /api/chat/health
```

Example:

```bash
curl http://127.0.0.1:8000/api/chat/health
```

Expected response:

```json
{
  "success": true,
  "message": "Chat service is running",
  "data": {
    "status": "ok"
  }
}
```

---

### Chat

```http
POST /api/chat
```

Content type:

```text
multipart/form-data
```

#### Fields

| Field | Required | Description |
|---|---:|---|
| `message` | Yes | Latest user message |
| `chat_history` | No | JSON string array of previous messages |
| `animal_type` | No | Optional animal type; backend can infer it |
| `image` | No | Optional animal image |

---

## Test Chat Without Image

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -F "message=My goat is sick" \
  -F "chat_history=[]"
```

Expected response type:

```json
{
  "responseType": "non_medical"
}
```

---

## Test Chat With Image

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -F "message=My goat has mouth blisters since yesterday" \
  -F "chat_history=[]" \
  -F "image=@/path/to/image.jpg"
```

Supported image types:

```text
image/jpeg
image/png
image/jpg
image/webp
```

Maximum image size:

```text
5MB
```

---

## Chat History Format

The `chat_history` field should be sent as a JSON string.

Example:

```json
[
  {
    "role": "user",
    "content": "My goat is sick."
  },
  {
    "role": "assistant",
    "content": "What symptoms is your goat showing?"
  }
]
```

When using `curl`, stringify it:

```bash
curl -X POST http://127.0.0.1:8000/api/chat \
  -F "message=It has mouth blisters since yesterday" \
  -F "chat_history=[{\"role\":\"user\",\"content\":\"My goat is sick.\"}]"
```

---

## Response Types

MaweshiAI returns one of three response types.

### 1. `non_medical`

Used when the assistant needs more minimum information.

```json
{
  "responseType": "non_medical",
  "chatReply": "I need a little more information to guide you safely.",
  "missingInfo": ["clear symptoms", "symptom duration"],
  "questions": [
    "What symptoms is your goat showing?",
    "How long has your goat been sick?"
  ],
  "safeNote": "If the animal is very weak, unable to stand, struggling to breathe, or rapidly worsening, contact a qualified veterinarian urgently."
}
```

---

### 2. `medical`

Used when animal type, clear symptom, and duration are available.

```json
{
  "responseType": "medical",
  "severity": "medium",
  "possibleConditions": [
    "Possible infectious mouth disease",
    "Possible oral injury or irritation"
  ],
  "chatReply": "Mouth blisters may indicate an infectious or oral health issue.",
  "careSteps": [
    "Keep the animal separate from the herd if infection is possible.",
    "Provide clean water and soft feed."
  ],
  "treatmentPlan": {
    "immediateCare": [
      "Separate the animal from the herd."
    ],
    "supportiveCare": [
      "Offer clean water and soft feed."
    ],
    "whenToCallVet": [
      "Call a vet if symptoms worsen or the animal stops eating."
    ],
    "monitoringChecklist": [
      "Monitor appetite, drinking, drooling, and weakness."
    ],
    "followUpQuestions": [
      "Is the goat drinking normally?"
    ]
  },
  "disclaimer": "This is general guidance only and not a veterinary diagnosis. Please consult a qualified veterinarian."
}
```

---

### 3. `false_input`

Used when the user asks something outside livestock health.

```json
{
  "responseType": "false_input",
  "chatReply": "MaweshiAI only helps with livestock health questions.",
  "reason": "The user is asking for a recipe, not livestock health guidance."
}
```

---

## Run the Console Chatbot

The console chatbot is useful for testing without running the API server.

From the `backend` folder:

```bash
python console_chatbot.py
```

Example:

```text
You > My goat is sick.

MaweshiAI:
What symptoms is your goat showing?
How long has your goat been sick?
```

Then:

```text
You > It has mouth blisters since yesterday.
```

Expected result:

```text
responseType: medical
severity: medium
```

---

## Console Commands

```text
/history
```

Shows chat history.

```text
/clear
```

Clears chat history.

```text
/exit
```

Exits the chatbot.

---

## Manual Test Cases

### Vague Livestock Message

```text
My goat is sick.
```

Expected:

```text
non_medical
Ask symptoms and duration only.
Do not ask what animal it is.
```

---

### Medical Minimum Information

```text
My goat has mouth blisters since yesterday.
```

Expected:

```text
medical
severity medium
non-empty treatmentPlan
```

---

### Urgent Symptoms

```text
My goat has mouth blisters since yesterday and is eating less with drooling.
```

Expected:

```text
medical
severity urgent
advise isolation and vet contact
```

---

### Non-Livestock Input

```text
Give me biryani recipe.
```

Expected:

```text
false_input
```

---

### History Follow-Up

Same chat:

```text
My goat is sick.
```

Then:

```text
It has mouth blisters since yesterday.
```

Expected:

```text
medical
The assistant should remember goat from history.
```

---

## Logging

If `LOG_GROQ_API=true`, Groq request and response logs are written to:

```text
backend/logs/
```

The logs are stored as JSONL. Multiline prompt text may appear with `\n` inside the JSON log. This is normal JSON escaping.

---

## Common Errors

### `No module named src`

Make sure you are running commands from the `backend` folder:

```bash
cd backend
uvicorn src.main:app --reload
```

---

### `Form data requires python-multipart`

Install:

```bash
pip install python-multipart
```

Also add it to `requirements.txt`.

---

### `GROQ_API_KEY is missing`

Make sure `.env` exists inside `backend` and contains:

```env
GROQ_API_KEY=your_groq_api_key_here
```

---

### Image Upload Does Not Work

Make sure `.env` contains:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Also ensure the image is under 5MB and one of:

```text
jpg
jpeg
png
webp
```

---

### Pylance Cannot Resolve `src`

If VS Code shows missing import warnings, add this to `.vscode/settings.json`:

```json
{
  "python.analysis.extraPaths": [
    "./backend"
  ]
}
```

If you opened the `backend` folder directly, use:

```json
{
  "python.analysis.extraPaths": [
    "."
  ]
}
```

---

## Development Notes

- `routes/chat.py` should stay thin and only adapt HTTP input to service input.
- `ai_service.py` handles Groq calls, JSON parsing, validation, retries, logging, and fallback.
- `prompt_service.py` builds prompts and conversation context.
- `vision_service.py` handles image validation and image observation generation.
- The frontend should send image files, not image observations.
- Image upload is optional.
- Chat history should be sent as a JSON string array.
- The assistant provides general guidance only and should not be treated as a veterinary diagnosis.

---

## Disclaimer

MaweshiAI provides general livestock health guidance only. It does not provide a final veterinary diagnosis and does not replace a qualified veterinarian. For urgent, severe, or worsening symptoms, contact a qualified veterinarian immediately.
