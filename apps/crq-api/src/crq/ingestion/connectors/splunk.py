"""Splunk SIEM connector parsing webhook alert payloads into CRQ event format."""

from __future__ import annotations

import json
import uuid
from typing import Any

from crq.ingestion.connectors.base import BaseConnector
from crq.schemas.events import EventEnvelope


class SplunkConnector(BaseConnector):
    """Parses Splunk SIEM alerts and search webhook payloads."""

    name: str = "splunk"

    async def fetch(self) -> list[dict[str, Any]]:
        """Poller stub for Splunk REST API."""
        return []

    def parse(self, raw_data: Any, org_id: uuid.UUID) -> list[EventEnvelope]:
        """Convert Splunk webhook payload into standardized events."""
        if isinstance(raw_data, (bytes, str)):
            text = raw_data.decode("utf-8") if isinstance(raw_data, bytes) else raw_data
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                return []
        elif isinstance(raw_data, dict):
            data = raw_data
        else:
            return []

        search_name = data.get("search_name", "splunk_alert")
        result = data.get("result", data)

        # Detect event category
        event_type = "incident.detected"
        if "control" in search_name.lower() or "mfa" in search_name.lower():
            event_type = "control.disabled"
        elif "vuln" in search_name.lower() or "cve" in search_name.lower():
            event_type = "vuln.detected"

        payload = {
            "search_name": search_name,
            "sid": data.get("sid"),
            "owner": data.get("owner"),
            "app": data.get("app"),
            "results_link": data.get("results_link"),
            "alert_details": result,
        }

        envelope = EventEnvelope(
            event_id=uuid.uuid4(),
            event_type=event_type,
            org_id=org_id,
            source="splunk",
            payload=payload,
        )
        return [envelope]
