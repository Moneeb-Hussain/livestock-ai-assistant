# Maweshi AI (livestock-ai-assistant)

Monorepo for **Maweshi AI**: a livestock health assistant focused on Pakistani livestock diseases—chat, treatment guidance, outbreak signals, and optional nearby vets (per architecture spec).

## Layout

| Path | Role |
|------|------|
| `frontend/` | React + Vite + Tailwind: chat, treatment plan, outbreak alerts, case UI, API client |
| `backend/` | FastAPI app: `/api/chat`, `/api/cases`, `/api/outbreaks`, optional `/api/vets` |
| `ai-services/` | Text / vision / audio pipelines (prompts, model clients)—integrate with or call from backend |
| `db/` | Supabase/PostgreSQL migrations and seeds (`outbreak_reports`, `outbreak_alerts`, etc.) |

## Target stack (MVP)

- **Frontend:** React, Vite, Tailwind, React Router, Axios or TanStack Query  
- **Backend:** Python FastAPI  
- **Database:** Supabase PostgreSQL  
- **AI:** Hugging Face Inference (text/vision); browser or server speech as needed  
- **Maps:** Browser geolocation + OpenStreetMap / Nominatim / Overpass (vet search); optional **Leaflet** + free tile/OSM for map UI

## Backend source shape

- `backend/src/routes/` — HTTP route modules  
- `backend/src/services/` — business logic (cases, outbreaks, AI orchestration)  
- `backend/src/validators/` — request/response validation  
- `backend/src/db/models/` — data models / DB access helpers  
- `backend/src/utils/` — safety, response shaping, helpers  

Application entrypoint (e.g. `main.py`) will live under `backend/src/` when the API is scaffolded.

---

Document reference: [Maweshi AI App architecture](https://docs.google.com/document/d/1DQssetF3gWAMZX3xntW3tD0Y7nIHcaf9WvqzRqlI4y4/edit).
