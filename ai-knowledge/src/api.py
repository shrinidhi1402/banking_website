"""
CRQ AI-Knowledge — FastAPI service.

Endpoints:
    POST /retrieve  — semantic context retrieval
    GET  /health    — health check
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.db import init_pool, close_pool, get_connection
from src.embedder import get_model, is_model_loaded
from src.models import (
    HealthResponse,
    RetrieveRequest,
    RetrieveResponse,
)
from src.retrieve import retrieve_context

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: warm up DB pool and embedding model.  Shutdown: close pool."""
    logger.info("Starting AI-Knowledge service …")
    await init_pool()
    get_model()  # pre-load the embedding model
    logger.info("AI-Knowledge service ready.")
    yield
    await close_pool()
    logger.info("AI-Knowledge service stopped.")


# ── App ───────────────────────────────────────────────────────

app = FastAPI(
    title="CRQ AI-Knowledge",
    description="RAG retrieval service for CyberRisk Quantifier",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the main backend calls this internally
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────

@app.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest) -> RetrieveResponse:
    """Retrieve semantically relevant knowledge chunks for a query."""
    results = await retrieve_context(
        query=req.query,
        top_k=req.top_k,
        framework=req.framework,
        source=req.source,
    )
    return RetrieveResponse(
        query=req.query,
        count=len(results),
        results=results,
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check — reports DB connectivity and model load status."""
    db_ok = False
    chunk_count = None
    try:
        async with get_connection() as conn:
            cursor = await conn.execute("SELECT count(*) AS cnt FROM knowledge_chunks")
            row = await cursor.fetchone()
            db_ok = True
            chunk_count = row["cnt"] if row else 0
    except Exception as exc:
        logger.warning("Health check DB query failed: %s", exc)

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        model_loaded=is_model_loaded(),
        db_connected=db_ok,
        chunk_count=chunk_count,
    )


# ── CLI entry point ──────────────────────────────────────────

def main() -> None:
    """Run the server via ``python -m src.api``."""
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "src.api:app",
        host="0.0.0.0",
        port=settings.ai_knowledge_port,
        reload=True,
    )


if __name__ == "__main__":
    main()
