"""Risk endpoints — B2.5 summary, contributors, and time-series history."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select

from crq.core.db import DbSession
from crq.core.logging import get_logger
from crq.models.asset import Asset
from crq.models.risk import EalSnapshot
from crq.models.vuln import Vulnerability
from crq.risk_engine.fair import compute_eal
from crq.schemas.risk import (
    RiskContributorItem,
    RiskContributorsResponse,
    RiskHistoryPoint,
    RiskHistoryResponse,
    RiskSummaryResponse,
)

log = get_logger(__name__)

router = APIRouter()


@router.get(
    "/summary",
    response_model=RiskSummaryResponse,
    summary="Get current risk summary and EAL metrics",
)
async def get_risk_summary(
    session: DbSession,
    scope: str = Query(
        default="org", pattern="^(org|bu|asset)$", description="Scope of the risk summary"
    ),
    id: uuid.UUID | None = Query(
        default=None, description="UUID of the specific scope entity (BU or Asset)"
    ),
    org_id: int = Query(default=1),
) -> RiskSummaryResponse:
    """Return the latest EAL snapshot with full audit provenance (architecture §6.6)."""
    # 1. Look for latest recorded snapshot in crq_eal_snapshots
    query = select(EalSnapshot).where(
        EalSnapshot.org_id == org_id,
        EalSnapshot.scope == scope,
    )
    if id is not None:
        query = query.where(EalSnapshot.scope_id == id)
    query = query.order_by(desc(EalSnapshot.computed_at)).limit(1)

    result = await session.execute(query)
    snapshot = result.scalar_one_or_none()

    if snapshot is not None:
        return RiskSummaryResponse(
            scope=snapshot.scope,
            scope_id=snapshot.scope_id,
            eal=float(snapshot.eal),
            var_95=float(snapshot.var_95 or snapshot.eal * 1.85),
            var_99=float(snapshot.var_99 or snapshot.eal * 2.40),
            loss_distribution=snapshot.loss_distribution or {},
            calculation_version=snapshot.calculation_version or "1.0",
            inputs_hash=snapshot.inputs_hash or "hash",
            computed_at=snapshot.computed_at,
        )

    # Return a 404 if no snapshot has been computed yet (e.g. Monte Carlo hasn't run)
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No risk snapshot found for {scope}={id} in org={org_id}",
    )


@router.get(
    "/contributors",
    response_model=RiskContributorsResponse,
    summary="Get top risk contributors ranked by EAL",
)
async def get_risk_contributors(
    session: DbSession,
    top: int = Query(default=10, ge=1, le=50, description="Number of top contributors to return"),
    org_id: int = Query(default=1),
) -> RiskContributorsResponse:
    """Return top asset and vulnerability contributors ranked by EAL contribution."""
    # Query assets sorted by criticality
    assets_stmt = (
        select(Asset)
        .where(Asset.org_id == org_id)
        .order_by(desc(Asset.criticality_score))
        .limit(top)
    )
    assets_res = await session.execute(assets_stmt)
    db_assets = list(assets_res.scalars().all())

    # Query vulnerabilities
    vuln_stmt = select(Vulnerability).order_by(desc(Vulnerability.cvss_score)).limit(top)
    vuln_res = await session.execute(vuln_stmt)
    db_vulns = list(vuln_res.scalars().all())

    contributors: list[RiskContributorItem] = []
    total_eal = 0.0

    for asset in db_assets:
        calc = compute_eal(
            asset_id=asset.id, org_id=org_id, criticality_score=asset.criticality_score
        )
        item_eal = calc["eal"]
        total_eal += item_eal
        contributors.append(
            RiskContributorItem(
                id=str(asset.id),
                name=asset.name,
                contributor_type="asset",
                eal_contribution=item_eal,
                percentage_of_total=0.0,  # normalized below
                criticality=asset.criticality_score,
                details={"hostname": asset.hostname, "environment": asset.environment},
            )
        )

    for vuln in db_vulns:
        vuln_eal = float((vuln.cvss_score or 5.0) * 250_000.0)
        total_eal += vuln_eal
        contributors.append(
            RiskContributorItem(
                id=str(vuln.id),
                name=f"{vuln.cve_id} - {vuln.description or 'Vulnerability'}",
                contributor_type="vulnerability",
                eal_contribution=vuln_eal,
                percentage_of_total=0.0,
                cvss_score=float(vuln.cvss_score) if vuln.cvss_score else None,
                details={"cve_id": vuln.cve_id, "in_cisa_kev": vuln.in_cisa_kev},
            )
        )

    # Sort and normalize percentages
    contributors.sort(key=lambda c: c.eal_contribution, reverse=True)
    contributors = contributors[:top]
    
    if total_eal > 0:
        for c in contributors:
            c.percentage_of_total = round((c.eal_contribution / total_eal) * 100.0, 2)

    return RiskContributorsResponse(
        total_eal=round(total_eal, 2),
        top_contributors=contributors,
    )


@router.get(
    "/history",
    response_model=RiskHistoryResponse,
    summary="Get EAL historical progression over time",
)
async def get_risk_history(
    session: DbSession,
    scope: str = Query(default="org", pattern="^(org|bu|asset)$"),
    id: uuid.UUID | None = Query(default=None),
    org_id: int = Query(default=1),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
) -> RiskHistoryResponse:
    """Query time-series EAL snapshots table."""
    now = datetime.now(UTC)
    start_time = from_date or (now - timedelta(days=90))
    end_time = to_date or now

    query = select(EalSnapshot).where(
        EalSnapshot.org_id == org_id,
        EalSnapshot.scope == scope,
        EalSnapshot.computed_at >= start_time,
        EalSnapshot.computed_at <= end_time,
    )
    if id is not None:
        query = query.where(EalSnapshot.scope_id == id)
    query = query.order_by(EalSnapshot.computed_at.asc())

    result = await session.execute(query)
    snapshots = list(result.scalars().all())

    points: list[RiskHistoryPoint] = []
    for s in snapshots:
        points.append(
            RiskHistoryPoint(
                timestamp=s.computed_at,
                eal=float(s.eal),
                var_95=float(s.var_95) if s.var_95 else None,
                var_99=float(s.var_99) if s.var_99 else None,
            )
        )

    return RiskHistoryResponse(
        scope=scope,
        scope_id=id,
        from_time=start_time,
        to_time=end_time,
        points=points,
    )
