"""Pydantic schemas for control and effectiveness endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ControlAssessmentItem(BaseModel):
    """Assessment record for an asset."""

    assessment_id: uuid.UUID
    asset_id: uuid.UUID
    asset_name: str | None = None
    coverage_pct: float
    config_quality: float
    freshness_days: int
    effectiveness: float
    assessed_at: datetime


class ControlEffectivenessResponse(BaseModel):
    """Aggregate control effectiveness response."""

    control_id: uuid.UUID
    key: str
    name: str
    description: str | None = None
    average_effectiveness: float = Field(description="Aggregated effectiveness score (0.0 to 1.0)")
    average_coverage_pct: float
    average_config_quality: float
    total_assets_assessed: int
    framework_refs: dict[str, Any] | None = None
    recent_assessments: list[ControlAssessmentItem] = Field(default_factory=list)
