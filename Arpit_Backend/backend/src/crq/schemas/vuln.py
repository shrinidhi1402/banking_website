"""Pydantic schemas for vulnerability endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class VulnerabilityResponse(BaseModel):
    """Vulnerability catalog representation."""

    id: int
    cve_id: str
    cvss_score: float | None = None
    exploit_available: bool = False
    in_cisa_kev: bool = False
    epss_score: float | None = None
    description: str | None = None
    published_at: datetime | None = None
    eal_contribution: float | None = Field(
        default=0.0, description="Computed EAL contribution across assets"
    )
    affected_assets_count: int = 0
