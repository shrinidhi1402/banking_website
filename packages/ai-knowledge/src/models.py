"""
CRQ AI-Knowledge — Pydantic request / response models.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Retrieval API ─────────────────────────────────────────────

class RetrieveRequest(BaseModel):
    """POST /retrieve request body."""
    query: str = Field(..., min_length=1, description="Natural-language query")
    top_k: int = Field(default=5, ge=1, le=50, description="Number of results")
    framework: str | None = Field(default=None, description="Filter by framework (e.g. 'NIST CSF')")
    source: str | None = Field(default=None, description="Filter by source file path")


class RetrievalResult(BaseModel):
    """A single retrieval result."""
    content: str
    source: str
    section: str | None
    framework: str | None
    similarity: float


class RetrieveResponse(BaseModel):
    """POST /retrieve response body."""
    query: str
    count: int
    results: list[RetrievalResult]


# ── Health ────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """GET /health response body."""
    status: str = "ok"
    model_loaded: bool
    db_connected: bool
    chunk_count: int | None = None
