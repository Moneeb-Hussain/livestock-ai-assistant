import logging

from fastapi import FastAPI

from src.routes.chat import router as chat_router
from src.routes.outbreak import router as outbreak_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(
    title="MaweshiAI Backend",
    description="Livestock health assistant API using FastAPI, Groq, and optional vision analysis.",
    version="1.0.0",
)

app.include_router(chat_router)
app.include_router(outbreak_router)



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