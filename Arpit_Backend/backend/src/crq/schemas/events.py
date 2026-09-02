"""Event schemas for ingestion API."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


class EventEnvelope(BaseModel):
    """Generic event ingestion envelope."""

    event_id: int = Field(
        default_factory=uuid.uuid4,
        description="Unique event ID supplied by client or generated for idempotency",
    )
    event_type: str = Field(
        ...,
        description="Event type identifier (e.g. control.disabled, vuln.detected, asset.added, incident.detected)",
        examples=["control.disabled", "vuln.detected", "asset.added"],
    )
    org_id: int = Field(
        ...,
        description="Tenant organization UUID",
    )
    source: str = Field(
        default="api",
        description="Source system identifier (e.g. bank-demo, qualys, tenable, splunk)",
    )
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary JSON payload containing event-specific data",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Event generation timestamp",
    )


class EventIngestResponse(BaseModel):
    """Response returned upon event ingestion."""

    event_id: int
    event_type: str
    status: str = Field(description="'received' if new, 'duplicate' if already ingested")
    topic: str | None = None
    message: str = "Event ingested successfully"
    received_at: datetime


class BatchEventIngestRequest(BaseModel):
    """Request envelope for multiple events."""

    events: list[EventEnvelope]


class BatchEventIngestResponse(BaseModel):
    """Response envelope for batch event ingestion."""

    total: int
    accepted: int
    duplicates: int
    results: list[EventIngestResponse]


class ScanUploadResponse(BaseModel):
    """Response returned upon scan file upload."""

    scanner: str
    total_findings: int
    ingested_events: int
    event_ids: list[uuid.UUID]
    message: str
