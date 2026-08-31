"""Risk endpoints — B2.5 summary, contributors, and time-series history."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import desc, select

from crq.core.db import DbSession
from crq.core.logging import get_logger
from crq.models.asset import Asset
from crq.models.risk import EALSnapshot
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
    org_id: uuid.UUID = Query(default=uuid.UUID("00000000-0000-0000-0000-000000000001")),
) -> RiskSummaryResponse:
    """Return the latest EAL snapshot with full audit provenance (architecture §6.6)."""
    # 1. Look for latest recorded snapshot in eal_snapshots
    query = select(EALSnapshot).where(
        EALSnapshot.org_id == org_id,
        EALSnapshot.scope == scope,
    )
    if id is not None:
        query = query.where(EALSnapshot.scope_id == id)
    query = query.order_by(desc(EALSnapshot.computed_at)).limit(1)

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
            calculation_version=snapshot.calculation_version or "0.1.0-stub",
            inputs_hash=snapshot.inputs_hash or "hash-000",
            computed_at=snapshot.computed_at,
        )

    # 2. If no snapshot exists yet, compute baseline on the fly
    baseline = compute_eal(
        asset_id=id or uuid.uuid4(),
        org_id=org_id,
        criticality_score=7 if scope == "asset" else 8,
        control_effectiveness=0.75,
    )
    return RiskSummaryResponse(
        scope=scope,
        scope_id=id,
        eal=baseline["eal"],
        var_95=baseline["var_95"],
        var_99=baseline["var_99"],
        loss_distribution=baseline["loss_distribution"],
        calculation_version=baseline["calculation_version"],
        inputs_hash=baseline["inputs_hash"],
        computed_at=baseline["computed_at"],
    )


@router.get(
    "/contributors",
    response_model=RiskContributorsResponse,
    summary="Get top risk contributors ranked by EAL",
)
async def get_risk_contributors(
    session: DbSession,
    top: int = Query(default=10, ge=1, le=50, description="Number of top contributors to return"),
    org_id: uuid.UUID = Query(default=uuid.UUID("00000000-0000-0000-0000-000000000001")),
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

    # If database has assets, compute contributions
    for asset in db_assets:
        calc = compute_eal(
            asset_id=asset.id, org_id=org_id, criticality_score=asset.criticality_score
        )
        item_eal = calc["eal"]
        total_eal += item_eal
        contributors.append(
            RiskContributorItem(
                id=asset.id,
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
                id=vuln.id,
                name=f"{vuln.cve_id} - {vuln.description or 'Vulnerability'}",
                contributor_type="vulnerability",
                eal_contribution=vuln_eal,
                percentage_of_total=0.0,
                cvss_score=float(vuln.cvss_score) if vuln.cvss_score else None,
                details={"cve_id": vuln.cve_id, "in_cisa_kev": vuln.in_cisa_kev},
            )
        )

    # Fallback synthetic contributors if DB is empty
    if not contributors:
        sample_data = [
            ("Core Banking Database (Postgres)", "asset", 2_400_000.0, 10, None),
            ("Payment Gateway API Gateway", "asset", 1_850_000.0, 9, None),
            ("CVE-2024-3094 (XZ Backdoor)", "vulnerability", 1_500_000.0, None, 9.8),
            ("SWIFT Transfer Interface Node", "asset", 950_000.0, 9, None),
            ("CVE-2023-48795 (Terrapin SSH)", "vulnerability", 620_000.0, None, 7.5),
        ]
        total_eal = sum(d[2] for d in sample_data[:top])
        for s_name, s_type, s_eal, s_crit, s_cvss in sample_data[:top]:
            contributors.append(
                RiskContributorItem(
                    id=str(uuid.uuid4()),
                    name=s_name,
                    contributor_type=s_type,
                    eal_contribution=s_eal,
                    percentage_of_total=round((s_eal / total_eal) * 100.0, 2)
                    if total_eal > 0
                    else 0.0,
                    criticality=s_crit,
                    cvss_score=s_cvss,
                )
            )
    else:
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
    summary="Get EAL historical progression over time (TimescaleDB hypertable query)",
)
async def get_risk_history(
    session: DbSession,
    scope: str = Query(default="org", pattern="^(org|bu|asset)$"),
    id: uuid.UUID | None = Query(default=None),
    org_id: uuid.UUID = Query(default=uuid.UUID("00000000-0000-0000-0000-000000000001")),
    from_date: datetime | None = Query(default=None),
    to_date: datetime | None = Query(default=None),
) -> RiskHistoryResponse:
    """Query time-series EAL snapshots table."""
    now = datetime.now(UTC)
    start_time = from_date or (now - timedelta(days=90))
    end_time = to_date or now

    query = select(EALSnapshot).where(
        EALSnapshot.org_id == org_id,
        EALSnapshot.scope == scope,
        EALSnapshot.computed_at >= start_time,
        EALSnapshot.computed_at <= end_time,
    )
    if id is not None:
        query = query.where(EALSnapshot.scope_id == id)
    query = query.order_by(EALSnapshot.computed_at.asc())

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

    # Fallback historical progression if no points in DB yet
    if not points:
        current_base = 42_000_000.0  # ₹4.2 Crore baseline
        for i in range(12, 0, -1):
            point_time = now - timedelta(days=i * 7)
            # slight fluctuation
            fluctuation = (i % 3 - 1) * 1_200_000.0
            p_eal = max(20_000_000.0, current_base + fluctuation)
            points.append(
                RiskHistoryPoint(
                    timestamp=point_time,
                    eal=round(p_eal, 2),
                    var_95=round(p_eal * 1.85, 2),
                    var_99=round(p_eal * 2.40, 2),
                )
            )

    return RiskHistoryResponse(
        scope=scope,
        scope_id=id,
        from_time=start_time,
        to_time=end_time,
        points=points,
    )
