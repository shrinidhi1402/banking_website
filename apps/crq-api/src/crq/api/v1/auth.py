"""Auth endpoints - B0.3."""

from fastapi import APIRouter

from crq.auth.supabase_auth import AuthUser

router = APIRouter()


@router.get("/me", summary="Get current user")
async def get_me(user: AuthUser) -> dict[str, str]:
    return {"sub": user.id, "email": user.email, "role": user.role}
