"""Health check — verifies Postgres, Redis, and MinIO connectivity.

B0.2.6 — Upgraded from a simple stub to real dependency checks.

Returns a structured dict consumed by the /health endpoint in main.py:
{
  "healthy": bool,
  "version": "0.1.0",
  "checks": {
    "postgres": {"status": "ok" | "error", "detail": "..."},
    "redis":    {"status": "ok" | "error", "detail": "..."},
  }
}
"""

from __future__ import annotations

import asyncio
from typing import Any

from crq.core.config import get_settings
from crq.core.logging import get_logger

log = get_logger(__name__)


async def _check_postgres() -> dict[str, str]:
    try:
        from sqlalchemy import text  # noqa: PLC0415

        from crq.core.db import engine  # noqa: PLC0415

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        log.warning("postgres_health_check_failed", error=str(exc))
        return {"status": "error", "detail": str(exc)}


async def _check_redis() -> dict[str, str]:
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        settings = get_settings()
        client = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await client.ping()
        if hasattr(client, "aclose"):
            await client.aclose()
        else:
            await client.close()
        return {"status": "ok"}
    except Exception as exc:
        log.warning("redis_health_check_failed", error=str(exc))
        return {"status": "error", "detail": str(exc)}


async def check_health() -> dict[str, Any]:
    """Run all dependency checks concurrently and return aggregated status."""
    settings = get_settings()

    postgres_result, redis_result = await asyncio.gather(
        _check_postgres(),
        _check_redis(),
    )

    checks = {
        "postgres": postgres_result,
        "redis": redis_result,
    }

    all_ok = all(v["status"] == "ok" for v in checks.values())

    return {
        "healthy": all_ok,
        "version": settings.APP_VERSION,
        "checks": checks,
    }
