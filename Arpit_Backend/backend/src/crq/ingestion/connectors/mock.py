"""Mock connector generating realistic synthetic bank security events."""

from __future__ import annotations

import random
import uuid
from typing import Any

from crq.ingestion.connectors.base import BaseConnector
from crq.schemas.events import EventEnvelope


class MockConnector(BaseConnector):
    """Generates synthetic security events for local development and integration testing."""

    name: str = "mock"

    def __init__(self, default_org_id: uuid.UUID | None = None) -> None:
        self.default_org_id = default_org_id or uuid.UUID("00000000-0000-0000-0000-000000000001")

    async def fetch(self) -> list[dict[str, Any]]:
        """Generate a random batch of synthetic telemetry events."""
        raw_events: list[dict[str, Any]] = [
            {
                "type": "control.disabled",
                "control": "mfa",
                "account_id": "adm-042",
                "asset_id": "core-banking-db",
                "asset_name": "Core Banking PostgreSQL Cluster",
                "severity": "critical",
            },
            {
                "type": "vuln.detected",
                "cve_id": "CVE-2024-3094",
                "cvss_score": 9.8,
                "asset_id": "payment-gateway-01",
                "asset_name": "Retail Payment Gateway Node 1",
                "title": "XZ Utils Backdoor Remote Code Execution",
            },
            {
                "type": "asset.criticality_changed",
                "asset_id": "core-banking-db",
                "asset_name": "Core Banking PostgreSQL Cluster",
                "previous_criticality": 8,
                "new_criticality": 10,
                "reason": "RBI Audit scope escalation",
            },
            {
                "type": "incident.detected",
                "incident_type": "privilege_escalation",
                "asset_id": "swift-interface-prod",
                "severity": "high",
            },
        ]
        return random.sample(raw_events, k=min(len(raw_events), 2))

    def parse(self, raw_data: Any, org_id: uuid.UUID | None = None) -> list[EventEnvelope]:
        """Convert list of raw dicts or single dict to EventEnvelope instances."""
        target_org_id = org_id or self.default_org_id
        items = raw_data if isinstance(raw_data, list) else [raw_data]

        events: list[EventEnvelope] = []
        for item in items:
            event_type = item.get("type", "control.updated")
            envelope = EventEnvelope(
                event_id=uuid.uuid4(),
                event_type=event_type,
                org_id=target_org_id,
                source="mock-generator",
                payload=item,
            )
            events.append(envelope)
        return events
