"""Asset and Dependency models."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crq.models.base import Base, IdMixin, TimestampMixin, UuidMixin

if TYPE_CHECKING:
    from crq.models.org import BusinessUnit, Organization
    from crq.models.control import ControlAssessment
    from crq.models.vuln import AssetVulnerability


class Asset(IdMixin, UuidMixin, TimestampMixin, Base):
    """Asset model mapping to crq_assets."""
    __tablename__ = "crq_assets"

    org_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_organizations.id"), nullable=False)
    business_unit_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("crq_business_units.id"), nullable=True)
    
    external_id: Mapped[str | None] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    hostname: Mapped[str | None] = mapped_column(String, nullable=True)
    asset_type: Mapped[str] = mapped_column(String, nullable=False)
    environment: Mapped[str] = mapped_column(String, default="production")
    criticality_score: Mapped[int] = mapped_column(Integer, default=5)
    criticality_inputs: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    downtime_cost_per_hour: Mapped[float] = mapped_column(Numeric, default=0)
    data_records_count: Mapped[int] = mapped_column(BigInteger, default=0)
    meta_info: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    organization: Mapped[Organization] = relationship("Organization", back_populates="assets")
    business_unit: Mapped[BusinessUnit | None] = relationship("BusinessUnit", back_populates="assets")
    
    control_assessments: Mapped[list[ControlAssessment]] = relationship(
        "ControlAssessment", back_populates="asset", cascade="all, delete-orphan"
    )
    vulnerabilities: Mapped[list[AssetVulnerability]] = relationship(
        "AssetVulnerability", back_populates="asset", cascade="all, delete-orphan"
    )


class AssetDependency(IdMixin, Base):
    """Asset Dependency model mapping to crq_asset_dependencies."""
    __tablename__ = "crq_asset_dependencies"

    source_asset_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_assets.id", ondelete="CASCADE"), nullable=False)
    target_asset_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_assets.id", ondelete="CASCADE"), nullable=False)
    dependency_type: Mapped[str] = mapped_column(String, default="network")
    
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
