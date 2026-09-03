"""Unit tests for B2.3 Celery Async Job Infrastructure (architecture §6.5)."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from crq.workers.tasks.recompute_eal import recompute_eal


@pytest.mark.unit
def test_recompute_eal_task_execution() -> None:
    """The recompute_eal Celery task function should execute and return calculation results."""
    org_id = str(uuid.uuid4())
    result = recompute_eal.apply(args=[org_id]).get()

    assert result["status"] == "completed"
    assert result["org_id"] == org_id
    assert "portfolio_eal" in result
    assert result["portfolio_eal"] > 0.0
    assert "calculation_version" in result
    assert "inputs_hash" in result


@pytest.mark.unit
@pytest.mark.asyncio
async def test_jobs_recompute_and_status_api(client: AsyncClient) -> None:
    """POST /api/v1/jobs/recompute should queue a job and return status_url."""
    org_id = str(uuid.uuid4())

    # 1. Trigger job
    post_res = await client.post(f"/api/v1/jobs/recompute?org_id={org_id}")
    assert post_res.status_code == 202
    data = post_res.json()
    assert "job_id" in data
    assert "status_url" in data
    job_id = data["job_id"]

    # 2. Query status
    status_res = await client.get(f"/api/v1/jobs/{job_id}")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["job_id"] == job_id
    assert "status" in status_data
