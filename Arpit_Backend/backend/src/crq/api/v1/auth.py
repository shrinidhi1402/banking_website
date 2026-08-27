"""Auth endpoints - B0.3."""

from fastapi import APIRouter

from crq.auth.keycloak import AuthUser

router = APIRouter()


@router.get("/me", summary="Get current user")
async def get_me(user: AuthUser) -> dict[str, str]:
    return {"sub": user.sub, "email": user.email, "role": user.role}
