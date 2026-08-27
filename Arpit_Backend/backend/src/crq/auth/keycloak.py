"""Keycloak JWT verification + get_current_user dependency.

B0.3 - Auth foundation.

CRITICAL: When DISABLE_AUTH=true (dev default), get_current_user returns
a fake admin user so teammates are NEVER blocked by Keycloak setup.

To enable real auth:
  1. Set CRQ_DISABLE_AUTH=false in .env
  2. Ensure Keycloak is running: docker compose -f docker-compose.dev.yml up keycloak
  3. Import realm: infra/keycloak/realm-export.json
  4. Set CRQ_KEYCLOAK_CLIENT_SECRET in .env

Roles (architecture ss10.2): ciso | analyst | bu_owner | auditor | admin
"""

from __future__ import annotations

from typing import Annotated, Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from crq.core.config import get_settings
from crq.core.logging import get_logger

log = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    """Represents the authenticated user on a request."""

    def __init__(
        self, sub: str, email: str, role: str, org_id: str | None = None, is_dev_user: bool = False
    ) -> None:
        self.sub = sub
        self.email = email
        self.role = role
        self.org_id = org_id
        self.is_dev_user = is_dev_user

    def __repr__(self) -> str:
        return f"CurrentUser(sub={self.sub!r}, role={self.role!r}, dev={self.is_dev_user})"


_jwks_cache: dict[str, Any] = {}


async def _fetch_jwks() -> dict[str, Any]:
    global _jwks_cache
    settings = get_settings()
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(settings.KEYCLOAK_JWKS_URL)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    return _jwks_cache


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> CurrentUser:
    """FastAPI dependency - returns authenticated CurrentUser.

    When DISABLE_AUTH=true, returns a fake admin user without JWT check.
    This is the dev default so teammates can write and test endpoints freely.
    """
    settings = get_settings()

    # DEV MODE - fake user, no Keycloak required
    if settings.DISABLE_AUTH:
        log.debug(
            "auth_disabled_returning_dev_user",
            note="Set CRQ_DISABLE_AUTH=false to enable real JWT validation",
        )
        return CurrentUser(
            sub="dev-user-00000000-0000-0000-0000-000000000000",
            email="dev@crq.local",
            role="admin",
            org_id="00000000-0000-0000-0000-000000000001",
            is_dev_user=True,
        )

    # PRODUCTION MODE - validate JWT against Keycloak JWKS
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        jwks = _jwks_cache or await _fetch_jwks()
        payload = jwt.decode(
            token, jwks, algorithms=["RS256"], audience=settings.KEYCLOAK_CLIENT_ID
        )
    except JWTError as exc:
        log.warning("jwt_validation_failed", error=str(exc))
        try:
            jwks = await _fetch_jwks()
            payload = jwt.decode(
                token, jwks, algorithms=["RS256"], audience=settings.KEYCLOAK_CLIENT_ID
            )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    realm_access: dict[str, list[str]] = payload.get("realm_access", {})
    roles = realm_access.get("roles", [])
    crq_roles = {"ciso", "analyst", "bu_owner", "auditor", "admin"}
    role = next((r for r in roles if r in crq_roles), "analyst")

    return CurrentUser(
        sub=payload.get("sub", ""),
        email=payload.get("email", ""),
        role=role,
        org_id=payload.get("org_id"),
        is_dev_user=False,
    )


AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
