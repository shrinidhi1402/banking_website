"""Budget optimization endpoints (architecture §4.4)."""

from fastapi import APIRouter, status
from pydantic import BaseModel

from crq.api.v1.jobs import JobSubmitResponse
from crq.workers.tasks.optimize_budget import optimize_budget_task

router = APIRouter()

class OptimizationRequest(BaseModel):
    budget: float
    actions: list[dict]
    org_id: int = 1

@router.post(
    "",
    response_model=JobSubmitResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger budget optimization task"
)
async def submit_optimization(req: OptimizationRequest) -> JobSubmitResponse:
    """Submit budget optimization task to Celery queue."""
    # Dispatch Celery task
    task = optimize_budget_task.delay(req.budget, req.actions)
    job_id = task.id
    status_url = f"/api/v1/jobs/{job_id}"
    
    return JobSubmitResponse(
        job_id=job_id,
        status="PENDING",
        status_url=status_url,
    )
