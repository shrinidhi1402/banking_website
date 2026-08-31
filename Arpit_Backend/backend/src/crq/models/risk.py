# STUB: replace with real B1.1 model
"""EALSnapshot model (stub for B1.1)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class EALSnapshot(AuditMixin, Base):
    """EAL snapshot core output table (TimescaleDB hypertable candidate)."""

    __tablename__ = "eal_snapshots"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # 'org', 'bu', 'asset', 'asset_vuln'
    scope_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    eal: Mapped[float] = mapped_column(Numeric(16, 2), nullable=False)
    var_95: Mapped[float | None] = mapped_column(Numeric(16, 2), nullable=True)
    var_99: Mapped[float | None] = mapped_column(Numeric(16, 2), nullable=True)
    loss_distribution: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)
    calculation_version: Mapped[str | None] = mapped_column(String(50), default="0.1.0")
    inputs_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )
    source_event_ids: Mapped[list[str] | None] = mapped_column(JsonType, default=list)
