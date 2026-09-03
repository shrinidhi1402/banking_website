"""
CRQ AI-Knowledge — Database connection provider.

Provides async connections to Supabase/Postgres with pgvector type registration.
Sets WindowsSelectorEventLoopPolicy on Windows to ensure psycopg async compatibility.
"""

from __future__ import annotations

import logging
import sys
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

# Enforce SelectorEventLoop on Windows for psycopg async support
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

import psycopg
from psycopg.rows import dict_row
from pgvector.psycopg import register_vector_async

from src.config import get_settings

logger = logging.getLogger(__name__)


async def init_pool() -> None:
    """No-op initialization for database connection provider."""
    logger.info("Database provider initialised.")


async def close_pool() -> None:
    """No-op cleanup for database connection provider."""
    logger.info("Database provider closed.")


@asynccontextmanager
async def get_connection() -> AsyncGenerator[psycopg.AsyncConnection, None]:
    """
    Yield a fresh async database connection with pgvector type registration.
    """
    settings = get_settings()
    async with await psycopg.AsyncConnection.connect(
        settings.supabase_db_url,
        row_factory=dict_row,
    ) as conn:
        await register_vector_async(conn)
        yield conn


async def get_sync_connection_string() -> str:
    """Return the raw connection string (for sync scripts)."""
    return get_settings().supabase_db_url
