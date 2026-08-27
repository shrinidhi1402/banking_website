"""Assets endpoints - stub, implemented in B2.5."""

from fastapi import APIRouter

router = APIRouter()


@router.get("", summary="List assets (stub)")
async def list_assets() -> dict[str, str]:
    return {"status": "stub", "message": "Implemented in Phase B2.5"}
