"""Tenable / Nessus connector parsing XML or JSON exports into CRQ event format."""

from __future__ import annotations

import json
import uuid
import xml.etree.ElementTree as ET
from typing import Any

from crq.ingestion.connectors.base import BaseConnector
from crq.schemas.events import EventEnvelope


class TenableConnector(BaseConnector):
    """Parses Tenable Nessus XML and JSON vulnerability scan exports."""

    name: str = "tenable"

    async def fetch(self) -> list[dict[str, Any]]:
        """Poller stub — would fetch from Tenable.io API in prod."""
        return []

    def parse(self, raw_data: Any, org_id: uuid.UUID) -> list[EventEnvelope]:
        """Parse raw XML / JSON Nessus scan output into vuln.detected events."""
        events: list[EventEnvelope] = []

        if isinstance(raw_data, (bytes, str)):
            text_data = (
                raw_data.decode("utf-8", errors="replace")
                if isinstance(raw_data, bytes)
                else raw_data
            )
            text_data = text_data.strip()

            # Attempt JSON parse first
            if text_data.startswith("{") or text_data.startswith("["):
                try:
                    parsed_json = json.loads(text_data)
                    items = (
                        parsed_json
                        if isinstance(parsed_json, list)
                        else parsed_json.get("vulnerabilities", [parsed_json])
                    )
                    for item in items:
                        events.append(
                            EventEnvelope(
                                event_id=uuid.uuid4(),
                                event_type="vuln.detected",
                                org_id=org_id,
                                source="tenable",
                                payload=item,
                            )
                        )
                    return events
                except json.JSONDecodeError:
                    pass

            # Attempt XML parse for Nessus XML
            if "<NessusClientData_v2>" in text_data or "<ReportHost" in text_data:
                try:
                    root = ET.fromstring(text_data)  # noqa: S314
                    for host in root.findall(".//ReportHost"):
                        hostname = host.attrib.get("name", "unknown-host")
                        for item in host.findall("ReportItem"):
                            plugin_name = item.attrib.get("pluginName", "Unknown Finding")
                            severity = item.attrib.get("severity", "1")
                            cvss_elem = item.find("cvss3_base_score")
                            if cvss_elem is None:
                                cvss_elem = item.find("cvss_base_score")
                            cvss_score = (
                                float(cvss_elem.text)
                                if cvss_elem is not None and cvss_elem.text
                                else 5.0
                            )

                            cve_elem = item.find("cve")
                            cve_id = (
                                cve_elem.text
                                if cve_elem is not None and cve_elem.text
                                else f"NESSUS-{item.attrib.get('pluginID', '0')}"
                            )

                            payload = {
                                "cve_id": cve_id,
                                "title": plugin_name,
                                "hostname": hostname,
                                "cvss_score": cvss_score,
                                "scanner_source": "tenable",
                                "severity": severity,
                                "status": "open",
                            }

                            events.append(
                                EventEnvelope(
                                    event_id=uuid.uuid4(),
                                    event_type="vuln.detected",
                                    org_id=org_id,
                                    source="tenable",
                                    payload=payload,
                                )
                            )
                    return events
                except ET.ParseError:
                    pass

        return events
