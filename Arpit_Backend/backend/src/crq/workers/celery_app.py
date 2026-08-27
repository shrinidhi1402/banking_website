"""Celery application - broker: Redis, result: Redis."""

from __future__ import annotations

from celery import Celery

from crq.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "crq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "crq.workers.tasks.recompute_eal",
        "crq.workers.tasks.optimize_budget",
        "crq.workers.tasks.generate_report",
        "crq.workers.tasks.poll_threat_intel",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
