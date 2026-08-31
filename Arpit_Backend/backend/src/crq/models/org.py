# STUB: replace with real B1.1 model
"""Organization and BusinessUnit models (stub for B1.1)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

# Fallback JSON type for generic compatibility
JsonType = JSON().with_variant(JSONB, "postgresql")


class Organization(AuditMixin, Base):
    """Organization tenant model."""

    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), default="banking")
    regulatory_scope: Mapped[list[str] | None] = mapped_column(JsonType, default=list)

    business_units: Mapped[list[BusinessUnit]] = relationship(
        "BusinessUnit", back_populates="organization", cascade="all, delete-orphan"
    )


class BusinessUnit(AuditMixin, Base):
    """Business Unit hierarchy model."""

    __tablename__ = "business_units"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    revenue_annual: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_units.id", ondelete="SET NULL"), nullable=True
    )

    organization: Mapped[Organization] = relationship(
        "Organization", back_populates="business_units"
    )
    assets: Mapped[list[Any]] = relationship("Asset", back_populates="business_unit")
