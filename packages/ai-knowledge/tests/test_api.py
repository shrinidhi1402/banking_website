"""
Phase 7 — Async FastAPI endpoint unit tests (/health and /retrieve).
"""

from __future__ import annotations

import pytest

from src.api import health, retrieve
from src.embedder import get_model
from src.models import RetrieveRequest


@pytest.mark.asyncio
async def test_api_health_direct() -> None:
    """health() endpoint should return status=ok, db_connected=True, model_loaded=True."""
    get_model()
    res = await health()
    assert res.status == "ok"
    assert res.db_connected is True
    assert res.model_loaded is True
    assert res.chunk_count is not None
    assert res.chunk_count >= 180


@pytest.mark.asyncio
async def test_api_retrieve_schema_question_direct() -> None:
    """retrieve() endpoint with schema question should return top_k results."""
    req = RetrieveRequest(query="what does approval_limit mean", top_k=3)
    res = await retrieve(req)
    assert res.query == req.query
    assert res.count > 0
    assert len(res.results) <= 3
    top_result = res.results[0]
    assert "approval_limit" in top_result.content.lower() or "manager_profiles" in top_result.content.lower()


@pytest.mark.asyncio
async def test_api_retrieve_framework_filter_direct() -> None:
    """retrieve() endpoint with framework filter should filter results."""
    req = RetrieveRequest(query="cybersecurity governance function", top_k=5, framework="NIST CSF")
    res = await retrieve(req)
    assert res.count > 0
    for chunk in res.results:
        assert chunk.framework == "NIST CSF"


@pytest.mark.asyncio
async def test_api_retrieve_cis_controls_direct() -> None:
    """retrieve() endpoint for CIS Controls should return relevant CIS chunks."""
    req = RetrieveRequest(query="CIS Implementation Group 1 safeguards", top_k=3)
    res = await retrieve(req)
    assert res.count > 0
    contents = " ".join(r.content.lower() for r in res.results)
    assert "cis" in contents or "safeguards" in contents


@pytest.mark.asyncio
async def test_api_retrieve_sebi_cscrf_direct() -> None:
    """retrieve() endpoint for SEBI CSCRF should return SEBI chunks."""
    req = RetrieveRequest(query="SEBI CSCRF 6 hour incident reporting deadline", top_k=3)
    res = await retrieve(req)
    assert res.count > 0
    contents = " ".join(r.content.lower() for r in res.results)
    assert "sebi" in contents or "cscrf" in contents
