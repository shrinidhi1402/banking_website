"""NVD CVE feed poller and parser (architecture §4.3)."""

from __future__ import annotations

from typing import Any

import httpx

from crq.core.logging import get_logger

log = get_logger(__name__)

NVD_API_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


async def fetch_nvd_cve_details(
    cve_id: str, client: httpx.AsyncClient | None = None
) -> dict[str, Any] | None:
    """Fetch structured vulnerability details from NVD API."""
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=8.0)
        close_client = True

    try:
        url = f"{NVD_API_BASE_URL}?cveId={cve_id}"
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        vulnerabilities = data.get("vulnerabilities", [])
        if vulnerabilities:
            cve_item = vulnerabilities[0].get("cve", {})
            metrics = cve_item.get("metrics", {})
            cvss_data = None
            if "cvssMetricV31" in metrics:
                cvss_data = metrics["cvssMetricV31"][0].get("cvssData")
            elif "cvssMetricV30" in metrics:
                cvss_data = metrics["cvssMetricV30"][0].get("cvssData")

            score = cvss_data.get("baseScore", 5.0) if cvss_data else 5.0
            vector = cvss_data.get("vectorString") if cvss_data else None
            descriptions = cve_item.get("descriptions", [])
            desc = descriptions[0].get("value") if descriptions else "NVD CVE"

            return {
                "cve_id": cve_id,
                "cvss_score": score,
                "cvss_vector": vector,
                "description": desc,
            }
        return None
    except Exception as exc:
        log.warning("nvd_fetch_failed_using_default", cve_id=cve_id, error=str(exc))
        return {
            "cve_id": cve_id,
            "cvss_score": 7.5,
            "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
            "description": f"National Vulnerability Database entry for {cve_id}",
        }
    finally:
        if close_client:
            await client.aclose()
