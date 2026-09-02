"""Report generation endpoints."""

import uuid
from fastapi import APIRouter, status
from pydantic import BaseModel
from crq.api.v1.jobs import JobSubmitResponse

router = APIRouter()

class ReportItem(BaseModel):
    id: str
    report_type: str
    framework: str | None = None
    status: str
    download_url: str

@router.post("/generate", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_report(framework: str = "NIST-CSF-2.0") -> JobSubmitResponse:
    """Trigger background generation of compliance/risk report."""
    job_id = str(uuid.uuid4())
    return JobSubmitResponse(
        job_id=job_id,
        status="PENDING",
        status_url=f"/api/v1/jobs/{job_id}",
        message="Report generation queued"
    )

@router.get("", response_model=list[ReportItem])
async def list_reports() -> list[ReportItem]:
    """List recently generated reports."""
    return [
        ReportItem(
            id="rep-123",
            report_type="compliance",
            framework="NIST-CSF-2.0",
            status="completed",
            download_url="/api/v1/reports/rep-123/download"
        )
    ]
