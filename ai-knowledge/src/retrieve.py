"""
CRQ AI-Knowledge — Retrieval function.

Core semantic search against knowledge_chunks using pgvector cosine distance.
"""

from __future__ import annotations

import logging

from src.db import get_connection
from src.embedder import embed_query
from src.models import RetrievalResult

logger = logging.getLogger(__name__)


async def retrieve_context(
    query: str,
    top_k: int = 5,
    framework: str | None = None,
    source: str | None = None,
) -> list[RetrievalResult]:
    """
    Embed the query and perform cosine-similarity search against
    ``knowledge_chunks``, returning the top-k most relevant results.

    Parameters
    ----------
    query : str
        Natural-language question.
    top_k : int
        Maximum number of results to return.
    framework : str | None
        Optional filter — only return chunks tagged with this framework.
    source : str | None
        Optional filter — only return chunks from this source file.

    Returns
    -------
    list[RetrievalResult]
        Ranked results with content, metadata, and similarity score.
    """
    query_embedding = embed_query(query)
    embedding_str = str(query_embedding)

    # Build dynamic WHERE clause and params
    conditions: list[str] = []
    # Params order: embedding (SELECT), [filters...], embedding (ORDER BY), top_k
    filter_params: list[object] = []

    if framework is not None:
        conditions.append("framework = %s")
        filter_params.append(framework)
    if source is not None:
        conditions.append("source = %s")
        filter_params.append(source)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    sql = f"""
        SELECT
            content,
            source,
            section,
            framework,
            1 - (embedding <=> %s::vector) AS similarity
        FROM knowledge_chunks
        {where_clause}
        ORDER BY embedding <=> %s::vector
        LIMIT %s
    """

    params: list[object] = [embedding_str, *filter_params, embedding_str, top_k]

    async with get_connection() as conn:
        cursor = await conn.execute(sql, params)
        rows = await cursor.fetchall()

    results = [
        RetrievalResult(
            content=row["content"],
            source=row["source"],
            section=row.get("section"),
            framework=row.get("framework"),
            similarity=float(row["similarity"]),
        )
        for row in rows
    ]

    logger.info(
        "retrieve_context(%r, top_k=%d) → %d results (best=%.4f)",
        query[:60],
        top_k,
        len(results),
        results[0].similarity if results else 0.0,
    )
    return results
