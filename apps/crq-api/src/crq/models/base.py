"""SQLAlchemy ORM base class and common mixins.

B0.2.5 — Upgraded for Supabase BigInt primary keys.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all CRQ ORM models."""
    pass


class IdMixin:
    """Mixin that adds a BigInt id primary key."""
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)


class UuidMixin:
    """Mixin that adds a UUID unique column."""
    uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False,
    )


class TimestampMixin:
    """Mixin that adds created_at and updated_at."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
