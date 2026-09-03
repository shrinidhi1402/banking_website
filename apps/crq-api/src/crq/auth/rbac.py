"""RBAC dependency for endpoint-level role enforcement.

Usage:
    from crq.auth.rbac import require_roles
    from crq.auth.keycloak import AuthUser

    @router.get("/sensitive")
    async def endpoint(user: AuthUser, _: None = Depends(require_roles("ciso", "admin"))):
        ...

Roles (architecture ss10.2):
  ciso      - executive view, full read
  analyst   - technical view, full read
  bu_owner  - scoped to own business unit
  auditor   - read-only, audit log access
  admin     - full access including user management
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, status

from crq.auth.keycloak import CurrentUser, get_current_user


def require_roles(*allowed_roles: str) -> Callable[..., CurrentUser]:
    """Return a FastAPI dependency that enforces role membership."""

    async def _check(
        user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' not permitted. Required: {list(allowed_roles)}",
            )
        return user

    return _check  # type: ignore[return-value]
