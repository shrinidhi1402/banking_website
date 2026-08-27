"""Unit tests for /health endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.unit
@pytest.mark.asyncio
async def test_health_returns_200_or_503(client: AsyncClient) -> None:
    """Health returns 200 when deps up, 503 when down (unit env has no docker)."""
    response = await client.get("/health")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "healthy" in data
    assert "checks" in data
    assert "version" in data


@pytest.mark.unit
@pytest.mark.asyncio
async def test_health_check_structure(client: AsyncClient) -> None:
    """Per-dependency checks must be present with valid status values."""
    response = await client.get("/health")
    checks = response.json().get("checks", {})
    assert "postgres" in checks
    assert "redis" in checks
    assert "minio" in checks
    for check in checks.values():
        assert "status" in check
        assert check["status"] in ("ok", "error")
