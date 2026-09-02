"""Natural Language Query API."""

from fastapi import APIRouter
from pydantic import BaseModel

from crq.core.db import DbSession
from crq.ai_gateway.pipeline import orchestrate_query

router = APIRouter()

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    answer: str
    context: dict
    plan: dict | None = None

@router.post("", response_model=QueryResponse)
async def ask_question(req: QueryRequest, session: DbSession) -> QueryResponse:
    """Submit a natural language question to the CRQ AI."""
    res = await orchestrate_query(req.query, session)
    return QueryResponse(
        answer=res.get("answer", ""),
        context=res.get("context", {}),
        plan=res.get("plan")
    )
