"""Pydantic schemas for asset endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AssetResponse(BaseModel):
    """Asset representation schema."""

    id: uuid.UUID
    org_id: uuid.UUID
    business_unit_id: uuid.UUID | None = None
    external_id: str | None = None
    name: str
    hostname: str | None = None
    asset_type: str
    environment: str
    criticality_score: int
    criticality_inputs: dict[str, Any] | None = None
    downtime_cost_per_hour: float | None = None
    data_records_count: int | None = None
    created_at: datetime
    updated_at: datetime


class AssetCreateRequest(BaseModel):
    """Asset creation payload."""

    org_id: uuid.UUID
    name: str
    business_unit_id: uuid.UUID | None = None
    hostname: str | None = None
    asset_type: str = "server"
    environment: str = "prod"
    criticality_score: int = Field(default=5, ge=1, le=10)
    criticality_inputs: dict[str, Any] = Field(default_factory=dict)
    downtime_cost_per_hour: float = 0.0
    data_records_count: int = 0
