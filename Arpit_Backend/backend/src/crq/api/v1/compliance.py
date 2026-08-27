"""Compliance endpoints - stub, implemented in B5.1."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/{framework}/gaps", summary="Compliance gaps (stub)")
async def compliance_gaps(framework: str) -> dict[str, str]:
    return {"status": "stub", "framework": framework, "message": "Implemented in Phase B5.1"}
