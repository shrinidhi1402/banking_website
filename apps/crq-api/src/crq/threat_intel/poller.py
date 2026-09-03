"""Threat intelligence synchronization orchestrator (architecture §4.3)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from crq.core.db import AsyncSessionLocal
from crq.core.logging import get_logger
from crq.ingestion.producer import publish_event
from crq.schemas.events import EventEnvelope
from crq.threat_intel.cisa_kev import sync_cisa_kev

log = get_logger(__name__)


async def run_threat_intel_sync(
    org_id: uuid.UUID = uuid.UUID("00000000-0000-0000-0000-000000000001"),
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Execute complete threat intelligence sync pass and emit intel.updated event."""
    log.info("starting_threat_intel_sync", org_id=str(org_id))

    synced_kev = 0
    if session is not None:
        synced_kev = await sync_cisa_kev(session)
        await session.commit()
    else:
        async with AsyncSessionLocal() as db_session:
            synced_kev = await sync_cisa_kev(db_session)
            await db_session.commit()

    # Emit intel.updated event to Redpanda
    event = EventEnvelope(
        event_id=uuid.uuid4(),
        event_type="intel.updated",
        org_id=org_id,
        source="threat_intel_poller",
        payload={
            "cisa_kev_synced": synced_kev,
            "sectors_targeted": ["banking", "financial_services"],
            "status": "completed",
        },
    )
    topic = await publish_event(event)

    return {
        "status": "success",
        "cisa_kev_records_synced": synced_kev,
        "event_published_to": topic,
    }
