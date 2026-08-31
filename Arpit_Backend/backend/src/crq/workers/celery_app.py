"""Celery application and beat schedule configuration (architecture §6.5)."""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

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
    task_time_limit=3600,  # 1 hour max for heavy Monte Carlo runs
    # Celery Beat schedule for periodic operations (architecture §4.3)
    beat_schedule={
        "daily-cisa-kev-polling": {
            "task": "crq.poll_threat_intel",
            "schedule": crontab(hour=2, minute=0),  # Daily at 02:00 UTC
            "kwargs": {"source": "cisa_kev"},
        },
        "nightly-portfolio-eal-recompute": {
            "task": "crq.recompute_eal",
            "schedule": crontab(hour=3, minute=30),  # Nightly at 03:30 UTC
            "kwargs": {"org_id": "00000000-0000-0000-0000-000000000001"},
        },
    },
)
