"""Unit tests for B2.4 Threat Intelligence feed pollers (architecture §4.3)."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from crq.threat_intel.cisa_kev import fetch_cisa_kev_catalog, sync_cisa_kev
from crq.threat_intel.epss import fetch_epss_score
from crq.threat_intel.nvd import fetch_nvd_cve_details
from crq.threat_intel.poller import run_threat_intel_sync


@pytest.mark.unit
@pytest.mark.asyncio
async def test_cisa_kev_fetch_and_sync(db_session: AsyncSession) -> None:
    """CISA KEV fetcher and synchronizer should populate database."""
    items = await fetch_cisa_kev_catalog()
    assert len(items) > 0
    assert "cveID" in items[0]

    # Sync into DB
    synced_count = await sync_cisa_kev(db_session, max_records=2)
    assert synced_count > 0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_nvd_fetch() -> None:
    """NVD poller should return structured CVE details."""
    details = await fetch_nvd_cve_details("CVE-2024-3094")
    assert details is not None
    assert details["cve_id"] == "CVE-2024-3094"
    assert "cvss_score" in details


@pytest.mark.unit
@pytest.mark.asyncio
async def test_epss_fetch() -> None:
    """EPSS poller should return float probability score."""
    score = await fetch_epss_score("CVE-2024-3094")
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_threat_intel_orchestrator(db_session: AsyncSession) -> None:
    """run_threat_intel_sync should orchestrate feed syncing and emit event."""
    result = await run_threat_intel_sync(session=db_session)
    assert result["status"] == "success"
    assert result["cisa_kev_records_synced"] > 0
    assert result["event_published_to"] == "intel.updated"
