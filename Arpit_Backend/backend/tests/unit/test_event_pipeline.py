"""Unit tests for B2.2 Event Processing Pipeline and recompute chain (architecture §3.2)."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from crq.ingestion.consumer import (
    DEAD_LETTER_QUEUE,
    route_to_dead_letter_queue,
)
from crq.ingestion.pipeline import handle_control_event
from crq.ingestion.producer import resolve_topic_for_event
from crq.schemas.events import EventEnvelope


@pytest.mark.unit
def test_topic_resolution() -> None:
    """Event types should map to the appropriate Redpanda topics per architecture §3.1."""
    assert resolve_topic_for_event("control.disabled") == "control.updated"
    assert resolve_topic_for_event("control.updated") == "control.updated"
    assert resolve_topic_for_event("vuln.detected") == "vuln.detected"
    assert resolve_topic_for_event("asset.added") == "asset.changed"
    assert resolve_topic_for_event("asset.criticality_changed") == "asset.changed"
    assert resolve_topic_for_event("intel.updated") == "intel.updated"
    assert resolve_topic_for_event("incident.detected") == "incident.detected"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_mfa_disabled_triggers_eal_recompute_and_threshold_alert(
    db_session: AsyncSession,
) -> None:
    """Full reproduction of architecture §3.2 worked example:

    1. Admin disables MFA on core banking asset
    2. Control evaluator sets effectiveness ~0
    3. FAIR engine recomputes higher EAL
    4. EAL snapshot is recorded
    5. Threshold monitor detects >20% increase and flags alert
    """
    org_id = uuid.uuid4()
    asset_id = uuid.uuid4()

    event = EventEnvelope(
        event_id=uuid.uuid4(),
        event_type="control.disabled",
        org_id=org_id,
        source="bank-admin-panel",
        payload={
            "control": "mfa",
            "account_id": "adm-042",
            "asset_id": str(asset_id),
            "asset_name": "Core Banking DB Cluster",
            "status": "disabled",
        },
    )

    result = await handle_control_event(event, db_session)

    assert result["control"] == "mfa"
    assert result["effectiveness"] == 0.0  # MFA disabled -> 0 effectiveness
    assert result["new_eal"] > 0.0
    assert result["threshold_alert"] is True  # EAL jumps significantly -> threshold breach


@pytest.mark.unit
@pytest.mark.asyncio
async def test_dead_letter_queue_on_failure() -> None:
    """Malformed messages should be safely captured in Dead Letter Queue without crashing."""
    initial_dlq_len = len(DEAD_LETTER_QUEUE)

    # Route an invalid message to DLQ
    try:
        raise ValueError("Simulated malformed payload parsing failure")
    except Exception as exc:
        await route_to_dead_letter_queue(
            raw_message={"corrupt": "data"},
            error=exc,
            topic="control.updated",
        )

    assert len(DEAD_LETTER_QUEUE) == initial_dlq_len + 1
    last_dlq_item = DEAD_LETTER_QUEUE[-1]
    assert last_dlq_item["original_topic"] == "control.updated"
    assert "Simulated malformed" in last_dlq_item["error"]
