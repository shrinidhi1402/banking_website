"""Controls endpoints — B2.5 control effectiveness scoring and assessment history."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from crq.core.db import DbSession
from crq.models.control import Control, ControlAssessment
from crq.schemas.control import ControlAssessmentItem, ControlEffectivenessResponse

router = APIRouter()


@router.get(
    "/{id}/effectiveness",
    response_model=ControlEffectivenessResponse,
    summary="Get control effectiveness score and breakdown (architecture §4.5)",
)
async def get_control_effectiveness(
    id: str,
    session: DbSession,
) -> ControlEffectivenessResponse:
    """Retrieve effectiveness scoring for a specific control (Coverage × Quality × Freshness)."""
    # Look up control by UUID or key
    try:
        control_uuid = uuid.UUID(id)
        stmt = select(Control).where(Control.uuid == control_uuid)
    except ValueError:
        stmt = select(Control).where(Control.key == id)

    result = await session.execute(stmt)
    control = result.scalar_one_or_none()

    if control is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Control with identifier '{id}' not found",
        )

    # Fetch recent assessments with EAGER LOADING for asset (Fixes BUG-02)
    assessments_stmt = (
        select(ControlAssessment)
        .options(selectinload(ControlAssessment.asset))
        .where(ControlAssessment.control_id == control.id)
        .order_by(desc(ControlAssessment.assessed_at))
        .limit(20)
    )
    assessments_res = await session.execute(assessments_stmt)
    assessments = list(assessments_res.scalars().all())

    if assessments:
        avg_eff = sum(float(a.effectiveness) for a in assessments) / len(assessments)
        avg_cov = sum(float(a.coverage_pct) for a in assessments) / len(assessments)
        avg_qual = sum(float(a.config_quality) for a in assessments) / len(assessments)
    else:
        avg_eff, avg_cov, avg_qual = 0.0, 0.0, 0.0

    recent_items = [
        ControlAssessmentItem(
            assessment_id=a.id,
            asset_id=a.asset_id,
            asset_name=a.asset.name if a.asset else None,
            coverage_pct=float(a.coverage_pct),
            config_quality=float(a.config_quality),
            freshness_days=a.freshness_days,
            effectiveness=float(a.effectiveness),
            assessed_at=a.assessed_at,
        )
        for a in assessments
    ]

    return ControlEffectivenessResponse(
        control_id=control.id,
        key=control.key,
        name=control.name,
        description=control.description,
        average_effectiveness=round(avg_eff, 4),
        average_coverage_pct=round(avg_cov, 2),
        average_config_quality=round(avg_qual, 3),
        total_assets_assessed=len(assessments),
        framework_refs=None,
        recent_assessments=recent_items,
    )
