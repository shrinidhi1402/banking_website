"""NL query endpoint - stub, implemented in B4.3."""

from fastapi import APIRouter

router = APIRouter()


@router.post("", summary="Natural language query (stub)")
async def nl_query() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B4.3"}
