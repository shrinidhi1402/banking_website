"""Task: compliance report generation - stub, B5.2."""

from __future__ import annotations

from crq.workers.celery_app import celery_app


@celery_app.task(name="crq.generate_report", bind=True)
def generate_report(self: object, org_id: str, framework: str) -> dict[str, str]:
    return {"status": "stub", "org_id": org_id, "framework": framework}
