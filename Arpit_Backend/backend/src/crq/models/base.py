"""SQLAlchemy ORM base class and audit mixins.

B0.2.5 — Every future model inherits from Base + AuditMixin.

AuditMixin provides:
  - id: UUID primary key (server-generated)
  - created_at: set on INSERT
  - updated_at: auto-updated on UPDATE via onupdate
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Shared declarative base for all CRQ ORM models."""

    pass


class AuditMixin:
    """Mixin that adds id, created_at, updated_at to any model.

    Usage:
        class Asset(AuditMixin, Base):
            __tablename__ = "assets"
            ...
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
