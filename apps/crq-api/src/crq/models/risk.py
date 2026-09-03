"""Risk Engine models (FAIR snapshots)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from crq.models.base import Base, IdMixin


class EalSnapshot(IdMixin, Base):
    """Point-in-time FAIR risk calculation snapshot."""
    __tablename__ = "crq_eal_snapshots"

    org_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_organizations.id"), nullable=False)
    scope: Mapped[str] = mapped_column(String, nullable=False)  # org, bu, asset
    scope_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    
    eal: Mapped[float] = mapped_column(Numeric, nullable=False)
    var_95: Mapped[float] = mapped_column(Numeric, nullable=False)
    var_99: Mapped[float] = mapped_column(Numeric, nullable=False)
    loss_distribution: Mapped[dict[str, float]] = mapped_column(JSONB, nullable=False)
    
    calculation_version: Mapped[str] = mapped_column(String, nullable=False)
    inputs_hash: Mapped[str] = mapped_column(String, nullable=False)
    
    source_event_ids: Mapped[list[uuid.UUID] | None] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
