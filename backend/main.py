"""
MaweshiAI — FastAPI Backend
Entry point — wires all routes, middleware, and exception handlers together.
Run with: uvicorn main:app --reload
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError

from src.config import get_settings
from src.routes import chat, cases, outbreaks
from src.utils.response_format import (
    validation_exception_handler,
    generic_exception_handler,
)

# Logging setup

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("maweshi")


# ─── Startup / shutdown ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("MaweshiAI backend starting — env=%s", settings.APP_ENV)
    logger.info("CORS allowed origins: %s", settings.allowed_origins_list)
    yield
    logger.info("MaweshiAI backend shutting down.")


# ─── App factory ──────────────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title="MaweshiAI API",
    description=(
        "Livestock health assistant API — specialised for Pakistani livestock diseases. "
        "Provides preliminary diagnosis guidance for farmers and livestock owners."
    ),
    version="0.1.0",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)


# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Exception handlers ───────────────────────────────────────────────────────

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(chat.router)
app.include_router(cases.router)
app.include_router(outbreaks.router)


# ─── Root health check ────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"service": "MaweshiAI API", "status": "running", "version": "0.1.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ─── Dev runner ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_ENV == "development",
    )
