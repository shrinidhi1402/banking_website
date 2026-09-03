"""Shared pagination, sorting, and query utilities for API v1."""

from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination query parameters."""

    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")


class PaginatedResponse[T](BaseModel):
    """Generic envelope for paginated list endpoints."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


async def paginate(
    session: AsyncSession,
    stmt: Select[Any],
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Any], int, int]:
    """Execute paginated select query returning (items, total_count, total_pages)."""
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one() or 0

    # Apply limit and offset
    offset = (page - 1) * page_size
    paginated_stmt = stmt.limit(page_size).offset(offset)
    result = await session.execute(paginated_stmt)
    items = list(result.scalars().all())

    total_pages = max(1, (total + page_size - 1) // page_size)
    return items, total, total_pages
