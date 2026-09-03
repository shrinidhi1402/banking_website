"""Control and Assessment models."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crq.models.base import Base, IdMixin, TimestampMixin, UuidMixin

if TYPE_CHECKING:
    from crq.models.asset import Asset


class Control(IdMixin, UuidMixin, TimestampMixin, Base):
    """Control model mapping to crq_controls."""
    __tablename__ = "crq_controls"

    key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    control_type: Mapped[str] = mapped_column(String, nullable=False)
    family: Mapped[str | None] = mapped_column(String, nullable=True)


class ControlAssessment(IdMixin, Base):
    """Assessment of a control on a specific asset."""
    __tablename__ = "crq_control_assessments"

    asset_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_assets.id", ondelete="CASCADE"), nullable=False)
    control_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("crq_controls.id"), nullable=False)
    
    coverage_pct: Mapped[float] = mapped_column(Numeric, default=0)
    config_quality: Mapped[float] = mapped_column(Numeric, default=1.0)
    freshness_days: Mapped[int] = mapped_column(Integer, default=0)
    effectiveness: Mapped[float] = mapped_column(Numeric, default=0)
    
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    asset: Mapped[Asset] = relationship("Asset", back_populates="control_assessments")
    control: Mapped[Control] = relationship("Control")
