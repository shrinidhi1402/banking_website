"""Threat Intelligence models."""

from __future__ import annotations

from typing import Any

from sqlalchemy import BigInteger, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from crq.models.base import Base, IdMixin, TimestampMixin


class ThreatIntel(IdMixin, TimestampMixin, Base):
    """Threat intel mapped to crq_threat_intel."""
    __tablename__ = "crq_threat_intel"

    source: Mapped[str] = mapped_column(String, nullable=False)
    cve_id: Mapped[str] = mapped_column(String, ForeignKey("crq_vulnerabilities.cve_id"), nullable=False)
    exploitation_status: Mapped[str] = mapped_column(String, nullable=False)
    
    threat_actors: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    sectors_targeted: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    meta_info: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
