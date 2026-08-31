# STUB: replace with real B1.1 model
"""Vulnerability and AssetVulnerability models (stub for B1.1)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class Vulnerability(AuditMixin, Base):
    """Vulnerability catalog model."""

    __tablename__ = "vulnerabilities"

    cve_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    cvss_score: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    cvss_vector: Mapped[str | None] = mapped_column(String(255), nullable=True)
    exploit_available: Mapped[bool] = mapped_column(Boolean, default=False)
    in_cisa_kev: Mapped[bool] = mapped_column(Boolean, default=False)
    epss_score: Mapped[float | None] = mapped_column(Numeric(6, 4), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    meta_info: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)

    asset_findings: Mapped[list[AssetVulnerability]] = relationship(
        "AssetVulnerability", back_populates="vulnerability"
    )


class AssetVulnerability(AuditMixin, Base):
    """Asset vulnerability finding junction model."""

    __tablename__ = "asset_vulnerabilities"

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vulnerability_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vulnerabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scanner_source: Mapped[str | None] = mapped_column(String(100), default="manual")
    status: Mapped[str] = mapped_column(
        String(50), default="open"
    )  # open, mitigating, resolved, accepted_risk
    eal_contribution: Mapped[float | None] = mapped_column(Numeric(14, 2), default=0.0)

    asset: Mapped[Any] = relationship("Asset", back_populates="vulnerabilities")
    vulnerability: Mapped[Vulnerability] = relationship(
        "Vulnerability", back_populates="asset_findings"
    )
