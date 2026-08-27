"""Task: threat intelligence polling - stub, B2.4."""

from __future__ import annotations

from crq.workers.celery_app import celery_app


@celery_app.task(name="crq.poll_threat_intel", bind=True)
def poll_threat_intel(self: object) -> dict[str, str]:
    return {"status": "stub"}
