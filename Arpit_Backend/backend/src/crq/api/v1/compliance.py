"""Compliance and Framework Gap endpoints (architecture §4.5)."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ComplianceSummaryResponse(BaseModel):
    framework: str
    overall_coverage_pct: float
    gaps_count: int

class GapItem(BaseModel):
    control_ref: str
    crq_key: str
    required_effectiveness: float
    current_effectiveness: float
    gap_severity: str

@router.get("", response_model=list[ComplianceSummaryResponse])
async def get_compliance_summary() -> list[ComplianceSummaryResponse]:
    """Get overall compliance coverage for monitored frameworks."""
    # MVP Stub - In a real system this queries crq_framework_controls joined with control_assessments
    return [
        ComplianceSummaryResponse(
            framework="NIST-CSF-2.0",
            overall_coverage_pct=85.0,
            gaps_count=3
        ),
        ComplianceSummaryResponse(
            framework="RBI-CSF",
            overall_coverage_pct=92.5,
            gaps_count=1
        )
    ]

@router.get("/{framework}/gaps", response_model=list[GapItem])
async def get_compliance_gaps(framework: str) -> list[GapItem]:
    """Get detailed control gaps for a specific framework."""
    if framework == "NIST-CSF-2.0":
        return [
            GapItem(
                control_ref="PR.AC-1",
                crq_key="mfa",
                required_effectiveness=0.95,
                current_effectiveness=0.85,
                gap_severity="HIGH"
            )
        ]
    return []
