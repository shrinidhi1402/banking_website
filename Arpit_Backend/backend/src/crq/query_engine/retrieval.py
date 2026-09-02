"""Vector retrieval for RAG using pgvector."""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from crq.core.logging import get_logger
from crq.ai_gateway.embeddings import embeddings_client
from crq.ai_gateway.prompts.templates import StructuredQuery

log = get_logger(__name__)

async def execute_retrieval(query: StructuredQuery, session: AsyncSession, org_id: int = 1) -> dict:
    """Execute vector + structured retrieval based on query plan."""
    
    context = {"query_type": query.query_type}
    
    if query.query_type == "top_risk":
        # Structured lookup from risk endpoints
        stmt = text("SELECT name, criticality_score FROM crq_assets WHERE org_id = :org ORDER BY criticality_score DESC LIMIT :limit")
        res = await session.execute(stmt, {"org": org_id, "limit": query.top_n})
        context["top_assets"] = [dict(row._mapping) for row in res]
        
    elif query.query_type == "vuln_lookup":
        stmt = text("SELECT cve_id, cvss_score, description FROM crq_vulnerabilities ORDER BY cvss_score DESC LIMIT :limit")
        res = await session.execute(stmt, {"limit": query.top_n})
        context["top_vulnerabilities"] = [dict(row._mapping) for row in res]
        
    elif query.query_type == "general_knowledge" and query.search_terms:
        # Vector search using TEI + pgvector
        search_text = " ".join(query.search_terms)
        try:
            embeddings = await embeddings_client.embed([search_text])
            vector = embeddings[0]
            
            # Use pgvector cosine distance `<=>`
            vector_str = f"[{','.join(str(f) for f in vector)}]"
            stmt = text("""
                SELECT content, source 
                FROM public.knowledge_chunks 
                ORDER BY embedding <=> :vector::vector 
                LIMIT :limit
            """)
            res = await session.execute(stmt, {"vector": vector_str, "limit": query.top_n})
            context["knowledge"] = [dict(row._mapping) for row in res]
            
        except Exception as exc:
            log.warning("vector_search_failed", error=str(exc))
            context["knowledge"] = "Vector search unavailable."
            
    return context
