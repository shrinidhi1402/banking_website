"""
Phase 7 — Tests: retrieval golden-query verification.

These tests require:
  1. knowledge_chunks to be populated (run ingestion first)
  2. The embedding model to be available
"""

from __future__ import annotations

import pytest
import psycopg
from pgvector.psycopg import register_vector

from src.config import get_settings
from src.embedder import embed_query


@pytest.fixture(scope="module")
def db_conn():
    settings = get_settings()
    conn = psycopg.connect(settings.supabase_db_url)
    register_vector(conn)
    yield conn
    conn.close()


def _retrieve_sync(
    conn: psycopg.Connection,
    query: str,
    top_k: int = 3,
) -> list[dict]:
    """Synchronous retrieval for testing (mirrors async retrieve_context)."""
    embedding = embed_query(query)
    cur = conn.execute(
        """
        SELECT content, source, section, framework,
               1 - (embedding <=> %s::vector) AS similarity
        FROM knowledge_chunks
        ORDER BY embedding <=> %s::vector
        LIMIT %s
        """,
        (str(embedding), str(embedding), top_k),
    )
    rows = cur.fetchall()
    return [
        {
            "content": r[0],
            "source": r[1],
            "section": r[2],
            "framework": r[3],
            "similarity": float(r[4]),
        }
        for r in rows
    ]


def test_approval_limit_retrieves_manager_profiles(db_conn: psycopg.Connection) -> None:
    """'what does approval_limit mean' should retrieve manager_profiles chunk."""
    results = _retrieve_sync(db_conn, "what does approval_limit mean")
    assert len(results) > 0
    top = results[0]
    assert "manager_profiles" in top["content"].lower() or "approval_limit" in top["content"].lower()


def test_fair_model_retrieval(db_conn: psycopg.Connection) -> None:
    """'FAIR loss event frequency' should retrieve FAIR model chunk."""
    results = _retrieve_sync(db_conn, "FAIR loss event frequency")
    assert len(results) > 0
    top_sources = [r["source"] for r in results[:3]]
    assert any("fair" in s.lower() for s in top_sources)


def test_failed_login_retrieval(db_conn: psycopg.Connection) -> None:
    """'failed login attempts' should retrieve login_events chunk."""
    results = _retrieve_sync(db_conn, "failed login attempts security")
    assert len(results) > 0
    top_content = " ".join(r["content"].lower() for r in results[:3])
    assert "login" in top_content or "login_events" in top_content


def test_cis_controls_retrieval(db_conn: psycopg.Connection) -> None:
    """'CIS Implementation Group 1 safeguards' should surface CIS Controls doc."""
    results = _retrieve_sync(db_conn, "CIS Implementation Group 1 safeguards baseline")
    assert len(results) > 0
    top_sources = [r["source"] for r in results[:3]]
    assert any("cis_controls" in s.lower() for s in top_sources)


def test_sebi_cscrf_retrieval(db_conn: psycopg.Connection) -> None:
    """'SEBI CSCRF 6 hour incident reporting deadline' should surface SEBI CSCRF doc."""
    results = _retrieve_sync(db_conn, "SEBI CSCRF 6 hour incident reporting deadline")
    assert len(results) > 0
    top_sources = [r["source"] for r in results[:3]]
    assert any("sebi_cscrf" in s.lower() for s in top_sources)


def test_security_policies_retrieval(db_conn: psycopg.Connection) -> None:
    """'Internal password complexity policy' should surface security_policies doc."""
    results = _retrieve_sync(db_conn, "internal bank password policy 12 characters lockout")
    assert len(results) > 0
    top_sources = [r["source"] for r in results[:3]]
    assert any("security_policies" in s.lower() for s in top_sources)


def test_cve_vulnerability_retrieval(db_conn: psycopg.Connection) -> None:
    """'CVSS v3.1 base metric scoring groups' should surface cve_concepts doc."""
    results = _retrieve_sync(db_conn, "CVSS v3.1 base metric scoring attack vector")
    assert len(results) > 0
    top_sources = [r["source"] for r in results[:3]]
    assert any("cve_concepts" in s.lower() for s in top_sources)


def test_similarity_score_range(db_conn: psycopg.Connection) -> None:
    """Similarity scores should be between 0 and 1."""
    results = _retrieve_sync(db_conn, "account balance")
    for r in results:
        assert 0.0 <= r["similarity"] <= 1.0


def test_results_ordered_by_similarity(db_conn: psycopg.Connection) -> None:
    """Results should be sorted by descending similarity."""
    results = _retrieve_sync(db_conn, "transaction monitoring")
    if len(results) >= 2:
        for i in range(len(results) - 1):
            assert results[i]["similarity"] >= results[i + 1]["similarity"]
