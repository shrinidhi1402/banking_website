"""
Phase 2 — Create the knowledge_chunks table and indexes.

Usage:
    python scripts/create_tables.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import psycopg
from src.config import get_settings


SCHEMA_SQL = """
-- Ensure pgvector extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge chunks table
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id          bigserial       PRIMARY KEY,
    source      text            NOT NULL,
    section     text,
    framework   text,
    content     text            NOT NULL,
    embedding   vector(1024)    NOT NULL,
    created_at  timestamptz     NOT NULL DEFAULT now()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
    ON public.knowledge_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Metadata filter indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source
    ON public.knowledge_chunks (source);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_framework
    ON public.knowledge_chunks (framework);
"""


def create_tables() -> None:
    """Execute the schema creation SQL."""
    settings = get_settings()

    print("=" * 60)
    print("  CRQ AI-Knowledge — Phase 2: Create Storage")
    print("=" * 60)

    try:
        with psycopg.connect(settings.supabase_db_url) as conn:
            with conn.transaction():
                conn.execute(SCHEMA_SQL)
            print("\n✓ knowledge_chunks table and indexes created/verified.")

            # Verify
            cur = conn.execute("""
                SELECT column_name, udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'knowledge_chunks'
                ORDER BY ordinal_position
            """)
            cols = cur.fetchall()
            print(f"\n  Table columns ({len(cols)}):")
            for col_name, udt_name in cols:
                print(f"    • {col_name}: {udt_name}")

            # Check indexes
            cur = conn.execute("""
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'knowledge_chunks'
            """)
            indexes = cur.fetchall()
            print(f"\n  Indexes ({len(indexes)}):")
            for idx_name, idx_def in indexes:
                print(f"    • {idx_name}")

    except Exception as exc:
        print(f"\n✗ Failed: {exc}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  ✓ Phase 2 complete.")
    print("=" * 60)


if __name__ == "__main__":
    create_tables()
