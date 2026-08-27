"""Task: budget optimization run - stub, B3.2."""

from __future__ import annotations

from crq.workers.celery_app import celery_app


@celery_app.task(name="crq.optimize_budget", bind=True)
def optimize_budget(self: object, org_id: str, budget: float) -> dict[str, str]:
    return {"status": "stub", "org_id": org_id}
