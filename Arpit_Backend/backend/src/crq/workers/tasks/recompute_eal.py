"""Task: full-portfolio EAL recompute - stub, B2.3."""

from __future__ import annotations

from crq.workers.celery_app import celery_app


@celery_app.task(name="crq.recompute_eal", bind=True)
def recompute_eal(self: object, org_id: str) -> dict[str, str]:
    return {"status": "stub", "org_id": org_id}
