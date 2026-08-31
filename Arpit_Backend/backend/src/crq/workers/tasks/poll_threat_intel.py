"""Task: threat intelligence polling (architecture §4.3)."""

from __future__ import annotations

import asyncio
from typing import Any

from crq.threat_intel.poller import run_threat_intel_sync
from crq.workers.celery_app import celery_app


@celery_app.task(name="crq.poll_threat_intel", bind=True)
def poll_threat_intel(self: Any, source: str = "cisa_kev") -> dict[str, Any]:
    """Periodic task to poll and update threat intelligence feeds."""
    result = asyncio.run(run_threat_intel_sync())
    return {
        "status": "completed",
        "task_id": self.request.id,
        "source": source,
        "details": result,
    }
