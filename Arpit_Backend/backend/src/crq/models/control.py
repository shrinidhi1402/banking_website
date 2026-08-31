# STUB: replace with real B1.1 model
"""Control and ControlAssessment models (stub for B1.1)."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from crq.models.base import AuditMixin, Base

JsonType = JSON().with_variant(JSONB, "postgresql")


class Control(AuditMixin, Base):
    """Control catalog model."""

    __tablename__ = "controls"

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    framework_refs: Mapped[dict[str, Any] | None] = mapped_column(JsonType, default=dict)

    assessments: Mapped[list[ControlAssessment]] = relationship(
        "ControlAssessment", back_populates="control"
    )


class ControlAssessment(AuditMixin, Base):
    """Control assessment per asset."""

    __tablename__ = "control_assessments"

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    control_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    coverage_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=100.0)  # 0-100
    config_quality: Mapped[float] = mapped_column(Numeric(4, 3), default=1.0)  # 0.0 - 1.0
    freshness_days: Mapped[int] = mapped_column(Integer, default=0)
    effectiveness: Mapped[float] = mapped_column(
        Numeric(5, 4), default=1.0
    )  # computed: coverage * quality * decay
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True
    )

    asset: Mapped[Any] = relationship("Asset", back_populates="control_assessments")
    control: Mapped[Control] = relationship("Control", back_populates="assessments")
