"""Risk endpoints - stub, implemented in B2.5."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/summary", summary="Risk summary (stub)")
async def risk_summary() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.5"}


@router.get("/contributors", summary="Top risk contributors (stub)")
async def risk_contributors() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.5"}


@router.get("/history", summary="Risk history (stub)")
async def risk_history() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.5"}
