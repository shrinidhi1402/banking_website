"""Async SQLAlchemy engine + session dependency.

B0.2 — Database bootstrap.

Architecture §6.1:
  - SQLAlchemy 2.0 async engine
  - Session yielded as a FastAPI dependency via get_db()
  - App connects via PgBouncer (transaction-mode pooling) in prod
  - Alembic uses DATABASE_URL_DIRECT (bypasses PgBouncer)

Security §10.2 — app connects as `crq_app` non-superuser role,
scoped only to the `crq` schema. Never as `postgres`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from crq.core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Engine — created once at module import time
# ---------------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    # echo=settings.DEBUG,  # Uncomment to log SQL in dev
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield an async database session, rolling back on exception."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Type alias for cleaner dependency injection in routers
DbSession = Annotated[AsyncSession, Depends(get_db)]
