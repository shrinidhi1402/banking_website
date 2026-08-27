"""Reports endpoints - stub, implemented in B5.2."""

from fastapi import APIRouter

router = APIRouter()


@router.post("/generate", summary="Generate report (stub)")
async def generate_report() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B5.2"}
