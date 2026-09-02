"""Ingestion endpoints — B2.1 event ingestion, idempotency, and scanner upload."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from crq.core.db import DbSession
from crq.core.logging import get_logger
from crq.ingestion.connectors.base import BaseConnector
from crq.ingestion.connectors.mock import MockConnector
from crq.ingestion.connectors.qualys import QualysConnector
from crq.ingestion.connectors.tenable import TenableConnector
from crq.ingestion import pipeline
from crq.models.event import IngestedEvent
from crq.schemas.events import (
    BatchEventIngestRequest,
    BatchEventIngestResponse,
    EventEnvelope,
    EventIngestResponse,
    ScanUploadResponse,
)

log = get_logger(__name__)

router = APIRouter()


async def process_single_event(
    event: EventEnvelope,
    session: DbSession,
) -> EventIngestResponse:
    """Process an event with idempotency guarantees."""
    # 1. Idempotency Check: query by event_id
    stmt = select(IngestedEvent).where(IngestedEvent.event_id == event.event_id)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        log.info(
            "idempotent_duplicate_event_received",
            event_id=str(event.event_id),
            event_type=event.event_type,
        )
        return EventIngestResponse(
            event_id=existing.event_id,
            event_type=existing.event_type,
            status="duplicate",
            topic=None,
            message="Event already ingested (idempotent 200 response)",
            received_at=existing.received_at,
        )

    # 2. Record new event
    now = datetime.now(UTC)
    db_event = IngestedEvent(
        event_id=event.event_id,
        event_type=event.event_type,
        org_id=event.org_id,
        source=event.source,
        payload=event.payload,
        received_at=now,
        processing_status="received",
    )
    session.add(db_event)
    await session.flush()

    # 3. Process event directly (replaces Redpanda publish)
    if event.event_type.startswith("control."):
        await pipeline.handle_control_event(event, session)
    elif event.event_type.startswith("vuln."):
        await pipeline.handle_vuln_event(event, session)

    db_event.processing_status = "processed"

    return EventIngestResponse(
        event_id=event.event_id,
        event_type=event.event_type,
        status="received",
        topic="direct.sync",
        message="Event accepted and processed synchronously",
        received_at=now,
    )


@router.post(
    "",
    response_model=EventIngestResponse,
    summary="Ingest a security event",
    status_code=status.HTTP_200_OK,
)
async def ingest_event(
    event: EventEnvelope,
    session: DbSession,
) -> EventIngestResponse:
    """Generic event ingestion endpoint with idempotency guarantee (architecture §6.4)."""
    return await process_single_event(event, session)


@router.post(
    "/batch",
    response_model=BatchEventIngestResponse,
    summary="Batch ingest security events",
)
async def ingest_batch_events(
    batch: BatchEventIngestRequest,
    session: DbSession,
) -> BatchEventIngestResponse:
    """Batch event ingestion endpoint."""
    results: list[EventIngestResponse] = []
    accepted = 0
    duplicates = 0

    for event in batch.events:
        res = await process_single_event(event, session)
        if res.status == "received":
            accepted += 1
        else:
            duplicates += 1
        results.append(res)

    return BatchEventIngestResponse(
        total=len(batch.events),
        accepted=accepted,
        duplicates=duplicates,
        results=results,
    )


@router.post(
    "/mock-generate",
    response_model=BatchEventIngestResponse,
    summary="Generate and ingest synthetic demo events",
)
async def generate_mock_events(
    session: DbSession,
    org_id: uuid.UUID = Query(default=uuid.UUID("00000000-0000-0000-0000-000000000001")),
    count: int = Query(default=3, ge=1, le=10),
) -> BatchEventIngestResponse:
    """Generate synthetic telemetry events using MockConnector and ingest them."""
    connector = MockConnector(default_org_id=org_id)
    raw_data = await connector.fetch()
    events = connector.parse(raw_data, org_id=org_id)

    results: list[EventIngestResponse] = []
    accepted = 0
    duplicates = 0

    for event in events[:count]:
        res = await process_single_event(event, session)
        if res.status == "received":
            accepted += 1
        else:
            duplicates += 1
        results.append(res)

    return BatchEventIngestResponse(
        total=len(results),
        accepted=accepted,
        duplicates=duplicates,
        results=results,
    )


@router.post(
    "/scan-results",
    response_model=ScanUploadResponse,
    summary="Upload bulk vulnerability scan results (Qualys CSV / Nessus XML)",
)
async def upload_scan_results(
    session: DbSession,
    file: UploadFile = File(...),
    scanner: str = Form(default="qualys"),
    org_id: uuid.UUID = Form(default=uuid.UUID("00000000-0000-0000-0000-000000000001")),
) -> ScanUploadResponse:
    """Parse and ingest bulk vulnerability scanner export file."""
    content = await file.read()

    connector: BaseConnector
    if scanner.lower() == "qualys":
        connector = QualysConnector()
    elif scanner.lower() in ("tenable", "nessus"):
        connector = TenableConnector()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported scanner type '{scanner}'. Supported: qualys, tenable",
        )

    events = connector.parse(content, org_id=org_id)
    ingested_ids: list[uuid.UUID] = []

    for event in events:
        res = await process_single_event(event, session)
        if res.status == "received":
            ingested_ids.append(res.event_id)

    return ScanUploadResponse(
        scanner=scanner,
        total_findings=len(events),
        ingested_events=len(ingested_ids),
        event_ids=ingested_ids,
        message=f"Successfully parsed {len(events)} findings and ingested {len(ingested_ids)} new events",
    )
