import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.chat import router as chat_router
from src.routes.outbreak import router as outbreak_router
from src.routes.vets import router as vets_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(
    title="MaweshiAI Backend",
    description="Livestock health assistant API using FastAPI, Groq, and optional vision analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(outbreak_router)
app.include_router(vets_router)



@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "MaweshiAI backend is running",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
    }