"""Scenarios endpoints - stub, implemented in B3.1."""

from fastapi import APIRouter

router = APIRouter()


@router.post("/simulate", summary="Simulate scenario (stub)")
async def simulate_scenario() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B3.1"}
