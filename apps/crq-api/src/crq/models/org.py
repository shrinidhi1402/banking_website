"""Organization and BusinessUnit models."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import BigInteger, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crq.models.base import Base, IdMixin, TimestampMixin, UuidMixin

if TYPE_CHECKING:
    from crq.models.asset import Asset


class Organization(IdMixin, UuidMixin, TimestampMixin, Base):
    """Organization tenant model."""
    __tablename__ = "crq_organizations"

    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str | None] = mapped_column(String, nullable=True)
    revenue_annual: Mapped[float | None] = mapped_column(Numeric, default=0)

    business_units: Mapped[list[BusinessUnit]] = relationship(
        "BusinessUnit", back_populates="organization", cascade="all, delete-orphan"
    )
    assets: Mapped[list[Asset]] = relationship(
        "Asset", back_populates="organization", cascade="all, delete-orphan"
    )


class BusinessUnit(IdMixin, UuidMixin, TimestampMixin, Base):
    """Business Unit hierarchy model."""
    __tablename__ = "crq_business_units"

    org_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_organizations.id", ondelete="CASCADE"), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("crq_business_units.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    revenue_share_pct: Mapped[float | None] = mapped_column(Numeric, default=0)

    organization: Mapped[Organization] = relationship("Organization", back_populates="business_units")
    assets: Mapped[list[Asset]] = relationship("Asset", back_populates="business_unit")
