# STUB: replace with real B1.1 model
"""ThreatIntel model (stub for B1.1)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class ThreatIntel(AuditMixin, Base):
    """Threat intelligence feed entries."""

    __tablename__ = "threat_intel"

    source: Mapped[str] = mapped_column(String(100), nullable=False)  # cisa_kev, nvd, epss, etc.
    cve_id: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    exploitation_status: Mapped[str | None] = mapped_column(
        String(50), default="theoretical"
    )  # in_the_wild, poc_available, theoretical
    threat_actors: Mapped[list[str] | None] = mapped_column(JsonType, default=list)
    sectors_targeted: Mapped[list[str] | None] = mapped_column(JsonType, default=list)
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )
    raw_data: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)
