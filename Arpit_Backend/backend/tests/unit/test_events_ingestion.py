"""Unit tests for B2.1 Ingestion API and connectors."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from crq.ingestion.connectors.qualys import QualysConnector
from crq.ingestion.connectors.tenable import TenableConnector


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_single_event_success(client: AsyncClient) -> None:
    """POST /api/v1/events should validate and accept a valid event envelope."""
    event_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    payload = {
        "event_id": event_id,
        "event_type": "control.disabled",
        "org_id": org_id,
        "source": "bank-demo",
        "payload": {
            "control": "mfa",
            "account_id": "adm-042",
            "asset_id": "core-banking-db",
        },
    }

    response = await client.post("/api/v1/events", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["event_id"] == event_id
    assert data["event_type"] == "control.disabled"
    assert data["status"] == "received"
    assert data["topic"] == "control.updated"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_event_idempotency(client: AsyncClient) -> None:
    """Duplicate event_id should return HTTP 200 with status 'duplicate' (architecture §6.4)."""
    event_id = str(uuid.uuid4())
    org_id = str(uuid.uuid4())

    payload = {
        "event_id": event_id,
        "event_type": "vuln.detected",
        "org_id": org_id,
        "source": "qualys",
        "payload": {"cve_id": "CVE-2024-3094", "cvss_score": 9.8},
    }

    # 1. First submission -> received
    resp1 = await client.post("/api/v1/events", json=payload)
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "received"

    # 2. Second submission with exact same event_id -> duplicate (HTTP 200)
    resp2 = await client.post("/api/v1/events", json=payload)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "duplicate"
    assert data2["event_id"] == event_id


@pytest.mark.unit
@pytest.mark.asyncio
async def test_ingest_batch_events(client: AsyncClient) -> None:
    """POST /api/v1/events/batch should ingest multiple events in a single call."""
    org_id = str(uuid.uuid4())
    events = [
        {
            "event_id": str(uuid.uuid4()),
            "event_type": "asset.added",
            "org_id": org_id,
            "payload": {"asset_name": "swift-node-01", "criticality": 9},
        },
        {
            "event_id": str(uuid.uuid4()),
            "event_type": "vuln.detected",
            "org_id": org_id,
            "payload": {"cve_id": "CVE-2023-48795", "cvss_score": 7.5},
        },
    ]

    response = await client.post("/api/v1/events/batch", json={"events": events})
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["accepted"] == 2
    assert data["duplicates"] == 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_mock_connector_flow(client: AsyncClient) -> None:
    """POST /api/v1/events/mock-generate should generate and ingest synthetic demo events."""
    response = await client.post("/api/v1/events/mock-generate?count=2")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["accepted"] == 2


@pytest.mark.unit
def test_qualys_connector_parsing() -> None:
    """QualysConnector should parse CSV lines into valid EventEnvelopes."""
    csv_sample = """IP,HOSTNAME,QID,TITLE,SEVERITY,CVE_ID,CVSS3_BASE
192.168.1.100,core-banking-db.bank.internal,105421,PostgreSQL Remote Execution,5,CVE-2024-3094,9.8
192.168.1.101,payment-gw.bank.internal,105422,Terrapin SSH Attack,4,CVE-2023-48795,7.5
"""
    connector = QualysConnector()
    org_id = uuid.uuid4()
    events = connector.parse(csv_sample, org_id=org_id)

    assert len(events) == 2
    assert events[0].event_type == "vuln.detected"
    assert events[0].payload["cve_id"] == "CVE-2024-3094"
    assert events[0].payload["cvss_score"] == 9.8
    assert events[1].payload["cve_id"] == "CVE-2023-48795"


@pytest.mark.unit
def test_tenable_connector_parsing() -> None:
    """TenableConnector should parse Nessus XML into valid EventEnvelopes."""
    xml_sample = """<?xml version="1.0" ?>
<NessusClientData_v2>
  <Report name="Bank Scan">
    <ReportHost name="core-banking-db.local">
      <ReportItem pluginID="19421" pluginName="OpenSSH Terrapin Flaw" severity="3">
        <cve>CVE-2023-48795</cve>
        <cvss3_base_score>7.5</cvss3_base_score>
      </ReportItem>
    </ReportHost>
  </Report>
</NessusClientData_v2>
"""
    connector = TenableConnector()
    org_id = uuid.uuid4()
    events = connector.parse(xml_sample, org_id=org_id)

    assert len(events) == 1
    assert events[0].event_type == "vuln.detected"
    assert events[0].payload["cve_id"] == "CVE-2023-48795"
    assert events[0].payload["cvss_score"] == 7.5
