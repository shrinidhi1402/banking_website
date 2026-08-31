"""Exploit Prediction Scoring System (EPSS) poller (architecture §4.3)."""

from __future__ import annotations

import httpx

from crq.core.logging import get_logger

log = get_logger(__name__)

EPSS_API_URL = "https://api.first.org/data/v1/epss"


async def fetch_epss_score(cve_id: str, client: httpx.AsyncClient | None = None) -> float:
    """Fetch EPSS probability (0.0 - 1.0) for a CVE."""
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=6.0)
        close_client = True

    try:
        url = f"{EPSS_API_URL}?cve={cve_id}"
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("data", [])
        if items:
            score = float(items[0].get("epss", 0.05))
            return score
        return 0.05
    except Exception as exc:
        log.warning("epss_fetch_failed_using_default", cve_id=cve_id, error=str(exc))
        return 0.10
    finally:
        if close_client:
            await client.aclose()
