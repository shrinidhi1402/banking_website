"""Pydantic schemas for risk endpoints and traceability."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RiskSummaryResponse(BaseModel):
    """Current risk summary for a given scope."""

    scope: str = Field(description="'org', 'bu', or 'asset'")
    scope_id: uuid.UUID | None = Field(
        default=None, description="ID of the scoped entity if applicable"
    )
    eal: float = Field(description="Expected Annual Loss in ₹ (INR)")
    var_95: float = Field(description="Value at Risk (95th percentile) in ₹")
    var_99: float = Field(description="Value at Risk (99th percentile) in ₹")
    loss_distribution: dict[str, Any] = Field(
        default_factory=dict, description="Histogram / percentile distribution"
    )
    calculation_version: str = Field(
        description="FAIR calculation engine version (architecture §6.6)"
    )
    inputs_hash: str = Field(description="SHA-256 hash of input parameters for traceability")
    computed_at: datetime = Field(description="Timestamp when EAL was computed")


class RiskContributorItem(BaseModel):
    """Individual contributor to overall organizational EAL."""

    id: uuid.UUID | str
    name: str
    contributor_type: str = Field(description="'asset' or 'vulnerability'")
    eal_contribution: float
    percentage_of_total: float
    criticality: int | None = None
    cvss_score: float | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class RiskContributorsResponse(BaseModel):
    """Ranked list of top risk contributors."""

    total_eal: float
    top_contributors: list[RiskContributorItem]


class RiskHistoryPoint(BaseModel):
    """A single time-series point in EAL history."""

    timestamp: datetime
    eal: float
    var_95: float | None = None
    var_99: float | None = None


class RiskHistoryResponse(BaseModel):
    """Historical EAL progression over time."""

    scope: str
    scope_id: uuid.UUID | None
    from_time: datetime
    to_time: datetime
    points: list[RiskHistoryPoint]
