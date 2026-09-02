"""Supabase JWT authentication middleware.

B0.3 — Replaces Keycloak with Supabase Auth verification.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict

from crq.core.config import get_settings

log = logging.getLogger(__name__)
settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/token",  # stub
    auto_error=False,
)

class CurrentUser(BaseModel):
    """Authenticated user info extracted from JWT."""
    id: str
    email: str
    role: str

    model_config = ConfigDict(frozen=True)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> CurrentUser:
    """Validate Supabase JWT and return user context."""
    if settings.DISABLE_AUTH:
        return CurrentUser(
            id="dev-admin-uuid",
            email="dev@crq.local",
            role="admin",
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Supabase uses HS256 with the JWT secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        
        user_id = payload.get("sub")
        email = payload.get("email", "")
        # Supabase allows adding custom claims in app_metadata
        app_metadata = payload.get("app_metadata", {})
        role = app_metadata.get("role", "customer")

        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token subject")

        return CurrentUser(
            id=user_id,
            email=email,
            role=role,
        )
    except JWTError as e:
        log.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


# Type alias for cleaner dependency injection in routers
AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
