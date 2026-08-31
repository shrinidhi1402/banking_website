# STUB: replace with real B1.1 model
"""Asset and AssetDependency models (stub for B1.1)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class Asset(AuditMixin, Base):
    """Asset inventory model."""

    __tablename__ = "assets"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    business_unit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_units.id", ondelete="SET NULL"), nullable=True
    )
    external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    asset_type: Mapped[str] = mapped_column(
        String(100), default="server"
    )  # server, endpoint, db, etc.
    environment: Mapped[str] = mapped_column(String(50), default="prod")  # prod, staging, dev
    criticality_score: Mapped[int] = mapped_column(Integer, default=5)  # 1-10
    criticality_inputs: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)
    downtime_cost_per_hour: Mapped[float | None] = mapped_column(Numeric(14, 2), default=0.0)
    data_records_count: Mapped[int | None] = mapped_column(Integer, default=0)
    meta_info: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)

    business_unit: Mapped[Any] = relationship("BusinessUnit", back_populates="assets")
    vulnerabilities: Mapped[list[Any]] = relationship("AssetVulnerability", back_populates="asset")
    control_assessments: Mapped[list[Any]] = relationship(
        "ControlAssessment", back_populates="asset"
    )


class AssetDependency(Base):
    """Asset dependency graph edge."""

    __tablename__ = "asset_dependencies"

    from_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    to_asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    dep_type: Mapped[str] = mapped_column(String(50), default="depends_on")
