# STUB: replace with real B1.1 model
"""IngestedEvent model for idempotent ingestion (stub for B1.1)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from crq.models.base import Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class IngestedEvent(Base):
    """Ingested events table (idempotency + event tracking)."""

    __tablename__ = "ingested_events"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(100), default="api")
    payload: Mapped[dict[str, Any]] = mapped_column(JsonType, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_status: Mapped[str] = mapped_column(
        String(50), default="received"
    )  # received, processed, failed
