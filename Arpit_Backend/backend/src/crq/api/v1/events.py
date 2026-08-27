"""Ingestion endpoint - stub, implemented in B2.1."""

from fastapi import APIRouter

router = APIRouter()


@router.post("", summary="Ingest security event (stub)")
async def ingest_event() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.1"}
