"""Event tracking models."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from crq.models.base import Base, IdMixin


class IngestedEvent(IdMixin, Base):
    """Raw event ingestion log mapped to crq_ingested_events."""
    __tablename__ = "crq_ingested_events"

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    org_id: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    processing_status: Mapped[str] = mapped_column(String, default="received")
    
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
