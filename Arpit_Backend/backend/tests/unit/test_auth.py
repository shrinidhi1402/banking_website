"""Unit tests for auth dependencies."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.asyncio
async def test_auth_me_with_disable_auth(client: AsyncClient) -> None:
    """With DISABLE_AUTH=true, /auth/me returns dev admin user."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["email"] == "dev@crq.local"
