"""
CRQ AI-Knowledge — Ingestion pipeline.

CLI that reads all markdown files from knowledge/, chunks them,
generates embeddings via bge-m3, and upserts into the knowledge_chunks
table.  Idempotent per source file.

Usage:
    python -m src.ingest                 # ingest everything
    python -m src.ingest --source schema_docs/bank_schema.md   # re-ingest one file
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector

from src.config import get_settings, KNOWLEDGE_DIR
from src.chunker import chunk_file
from src.embedder import embed_texts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


def _collect_files(source_filter: str | None = None) -> list[Path]:
    """Collect markdown files from the knowledge directory."""
    if source_filter:
        target = KNOWLEDGE_DIR / source_filter
        if not target.exists():
            logger.error("Source file not found: %s", target)
            sys.exit(1)
        return [target]
    return sorted(KNOWLEDGE_DIR.rglob("*.md"))


def _upsert_chunks(
    conn: psycopg.Connection,
    source: str,
    contents: list[str],
    sections: list[str | None],
    frameworks: list[str | None],
    embeddings: list[list[float]],
) -> int:
    """
    Delete existing chunks for this source, then insert new ones.
    All within the caller's transaction.
    """
    conn.execute("DELETE FROM knowledge_chunks WHERE source = %s", (source,))

    inserted = 0
    for content, section, framework, embedding in zip(
        contents, sections, frameworks, embeddings, strict=True
    ):
        conn.execute(
            """
            INSERT INTO knowledge_chunks (source, section, framework, content, embedding)
            VALUES (%s, %s, %s, %s, %s::vector)
            """,
            (source, section, framework, content, str(embedding)),
        )
        inserted += 1

    return inserted


def ingest(source_filter: str | None = None) -> dict[str, int]:
    """
    Run the full ingestion pipeline.

    Returns a dict mapping source → chunk count.
    """
    settings = get_settings()
    files = _collect_files(source_filter)

    if not files:
        logger.warning("No markdown files found in %s", KNOWLEDGE_DIR)
        return {}

    logger.info("Found %d file(s) to ingest.", len(files))

    # ── Chunk all files ───────────────────────────────────────
    all_chunks = []
    for filepath in files:
        chunks = chunk_file(filepath, KNOWLEDGE_DIR)
        all_chunks.extend(chunks)
        logger.info("  %s → %d chunks", filepath.name, len(chunks))

    if not all_chunks:
        logger.warning("No chunks produced — check your knowledge docs.")
        return {}

    # ── Embed all chunks ──────────────────────────────────────
    logger.info("Embedding %d chunks …", len(all_chunks))
    texts = [c.content for c in all_chunks]
    embeddings = embed_texts(texts)
    logger.info("Embeddings generated.")

    # ── Upsert into database ──────────────────────────────────
    logger.info("Upserting into knowledge_chunks …")
    results: dict[str, int] = {}

    with psycopg.connect(settings.supabase_db_url) as conn:
        register_vector(conn)

        # Group chunks by source for idempotent upsert
        sources: dict[str, list[int]] = {}
        for i, chunk in enumerate(all_chunks):
            sources.setdefault(chunk.source, []).append(i)

        for source, indices in sources.items():
            with conn.transaction():
                count = _upsert_chunks(
                    conn,
                    source=source,
                    contents=[all_chunks[i].content for i in indices],
                    sections=[all_chunks[i].section for i in indices],
                    frameworks=[all_chunks[i].framework for i in indices],
                    embeddings=[embeddings[i] for i in indices],
                )
            results[source] = count
            logger.info("  ✓ %s — %d chunks", source, count)

    total = sum(results.values())
    logger.info("Ingestion complete — %d chunks across %d sources.", total, len(results))
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest knowledge docs into vector DB")
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Re-ingest a single source file (relative path inside knowledge/)",
    )
    args = parser.parse_args()
    ingest(source_filter=args.source)


if __name__ == "__main__":
    main()
