"""Optimizer endpoints - stub, implemented in B3.2."""

from fastapi import APIRouter

router = APIRouter()


@router.post("", summary="Run budget optimizer (stub)")
async def run_optimizer() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B3.2"}
