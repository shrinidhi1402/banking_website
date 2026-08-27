"""Vulnerabilities endpoints - stub, implemented in B2.5."""

from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="List vulnerabilities (stub)")
async def list_vulnerabilities() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.5"}
