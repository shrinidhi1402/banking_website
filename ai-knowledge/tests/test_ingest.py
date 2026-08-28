"""
Phase 7 — Tests: ingestion pipeline verification.
"""

from __future__ import annotations

import pytest
import psycopg

from src.config import get_settings


@pytest.fixture(scope="module")
def db_conn():
    settings = get_settings()
    conn = psycopg.connect(settings.supabase_db_url)
    yield conn
    conn.close()


def test_chunks_exist(db_conn: psycopg.Connection) -> None:
    """After ingestion, knowledge_chunks should have rows (expecting 186 chunks)."""
    cur = db_conn.execute("SELECT count(*) FROM knowledge_chunks")
    row = cur.fetchone()
    assert row is not None
    count = row[0]
    assert count >= 180, f"Expected >= 180 chunks, got {count}"


def test_no_duplicate_sources(db_conn: psycopg.Connection) -> None:
    """Each source file should have been ingested idempotently."""
    cur = db_conn.execute("""
        SELECT source, count(*) AS cnt
        FROM knowledge_chunks
        GROUP BY source
        ORDER BY source
    """)
    rows = cur.fetchall()
    assert len(rows) >= 12, f"Expected >= 12 sources, got {len(rows)}"
    for source, cnt in rows:
        assert cnt > 0, f"Source {source} has 0 chunks"


def test_all_chunks_have_embeddings(db_conn: psycopg.Connection) -> None:
    """Every chunk must have a non-null embedding."""
    cur = db_conn.execute("""
        SELECT count(*) FROM knowledge_chunks WHERE embedding IS NULL
    """)
    row = cur.fetchone()
    assert row is not None
    assert row[0] == 0, "Found chunks with NULL embeddings"


def test_schema_docs_ingested(db_conn: psycopg.Connection) -> None:
    """The bank_schema.md file should have produced multiple chunks."""
    cur = db_conn.execute("""
        SELECT count(*) FROM knowledge_chunks
        WHERE source LIKE '%bank_schema%'
    """)
    row = cur.fetchone()
    assert row is not None
    assert row[0] >= 5, f"Expected >=5 schema chunks, got {row[0]}"


def test_new_sources_ingested(db_conn: psycopg.Connection) -> None:
    """Verify all newly added sources were ingested."""
    cur = db_conn.execute("SELECT DISTINCT source FROM knowledge_chunks ORDER BY source")
    sources = {row[0] for row in cur.fetchall()}

    expected_fragments = [
        "bank_schema",
        "fair_model",
        "nl_to_sql",
        "pci_dss",
        "cis_controls",
        "sebi_cscrf",
        "security_policies",
        "cve_concepts",
        "golden_eval_set",
    ]
    for frag in expected_fragments:
        matches = [s for s in sources if frag in s]
        assert len(matches) > 0, f"No chunks found for source matching '{frag}'"
