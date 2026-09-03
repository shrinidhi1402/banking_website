"""Vulnerability models."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crq.models.base import Base, IdMixin, TimestampMixin

if TYPE_CHECKING:
    from crq.models.asset import Asset


class Vulnerability(IdMixin, TimestampMixin, Base):
    """Global vulnerability model mapping to crq_vulnerabilities."""
    __tablename__ = "crq_vulnerabilities"

    cve_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(Numeric(3, 1), nullable=True)
    epss_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    in_cisa_kev: Mapped[bool] = mapped_column(Boolean, default=False)
    exploit_available: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    asset_links: Mapped[list[AssetVulnerability]] = relationship(
        "AssetVulnerability", back_populates="vulnerability", cascade="all, delete-orphan"
    )


class AssetVulnerability(IdMixin, Base):
    """Mapping of vulnerability to specific asset."""
    __tablename__ = "crq_asset_vulnerabilities"

    asset_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_assets.id", ondelete="CASCADE"), nullable=False)
    vulnerability_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_vulnerabilities.id", ondelete="CASCADE"), nullable=False)
    
    status: Mapped[str] = mapped_column(String, default="open")
    
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    eal_contribution: Mapped[float] = mapped_column(Numeric, default=0)

    asset: Mapped[Asset] = relationship("Asset", back_populates="vulnerabilities")
    vulnerability: Mapped[Vulnerability] = relationship("Vulnerability", back_populates="asset_links")
