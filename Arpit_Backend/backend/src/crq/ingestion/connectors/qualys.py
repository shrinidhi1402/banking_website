"""Qualys connector parsing CSV vulnerability reports into CRQ event format."""

from __future__ import annotations

import csv
import io
import uuid
from typing import Any

from crq.ingestion.connectors.base import BaseConnector
from crq.schemas.events import EventEnvelope


class QualysConnector(BaseConnector):
    """Parses Qualys VM vulnerability scan CSV exports."""

    name: str = "qualys"

    async def fetch(self) -> list[dict[str, Any]]:
        """Poller stub — would fetch from Qualys Cloud Platform API in prod."""
        return []

    def parse(self, raw_data: Any, org_id: uuid.UUID) -> list[EventEnvelope]:
        """Parse raw CSV text or bytes into vuln.detected events."""
        events: list[EventEnvelope] = []

        if isinstance(raw_data, bytes):
            text_data = raw_data.decode("utf-8", errors="replace")
        elif isinstance(raw_data, str):
            text_data = raw_data
        elif isinstance(raw_data, list):
            # Already parsed dicts
            for item in raw_data:
                events.append(
                    EventEnvelope(
                        event_id=uuid.uuid4(),
                        event_type="vuln.detected",
                        org_id=org_id,
                        source="qualys",
                        payload=item,
                    )
                )
            return events
        else:
            return []

        # Parse CSV lines
        reader = csv.DictReader(io.StringIO(text_data))
        for row in reader:
            # Handle standard Qualys CSV column names (case-insensitive fallback)
            row_normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            cve_id = (
                row_normalized.get("cve_id")
                or row_normalized.get("cve")
                or row_normalized.get("qid", "QID-0")
            )
            title = row_normalized.get("title") or row_normalized.get(
                "vulnerability title", "Unknown Finding"
            )
            hostname = (
                row_normalized.get("hostname")
                or row_normalized.get("dns")
                or row_normalized.get("ip", "host-01")
            )
            cvss_str = (
                row_normalized.get("cvss3_base")
                or row_normalized.get("cvss_base")
                or row_normalized.get("severity", "5.0")
            )

            try:
                cvss_score = float(cvss_str)
            except ValueError:
                cvss_score = 5.0

            payload = {
                "cve_id": cve_id,
                "title": title,
                "hostname": hostname,
                "cvss_score": cvss_score,
                "scanner_source": "qualys",
                "severity": row_normalized.get("severity", "medium"),
                "status": "open",
                "raw_fields": row_normalized,
            }

            events.append(
                EventEnvelope(
                    event_id=uuid.uuid4(),
                    event_type="vuln.detected",
                    org_id=org_id,
                    source="qualys",
                    payload=payload,
                )
            )

        return events
