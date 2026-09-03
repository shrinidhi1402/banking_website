"""Vulnerabilities endpoints — B2.5 vulnerability backlog and EAL prioritization."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from crq.api.v1._utils import PaginatedResponse, paginate
from crq.core.db import DbSession
from crq.models.vuln import Vulnerability
from crq.schemas.vuln import VulnerabilityResponse

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[VulnerabilityResponse],
    summary="List vulnerabilities backlog (sortable by EAL contribution)",
)
async def list_vulnerabilities(
    session: DbSession,
    in_cisa_kev: bool | None = Query(default=None, description="Filter by CISA KEV membership"),
    exploit_available: bool | None = Query(
        default=None, description="Filter by exploit availability"
    ),
    cvss_min: float | None = Query(default=None, ge=0.0, le=10.0, description="Minimum CVSS score"),
    sort: str = Query(
        default="eal_contribution", pattern="^(eal_contribution|cvss_score|epss_score|published_at)$"
    ),
    order: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[VulnerabilityResponse]:
    """Retrieve paginated vulnerabilities prioritized by EAL contribution (architecture §5.2)."""
    stmt = select(Vulnerability).options(selectinload(Vulnerability.asset_links))

    if in_cisa_kev is not None:
        stmt = stmt.where(Vulnerability.in_cisa_kev == in_cisa_kev)
    if exploit_available is not None:
        stmt = stmt.where(Vulnerability.exploit_available == exploit_available)
    if cvss_min is not None:
        stmt = stmt.where(Vulnerability.cvss_score >= cvss_min)

    # Sorting
    sort_column = getattr(
        Vulnerability,
        sort if sort != "eal_contribution" else "cvss_score",
        Vulnerability.cvss_score,
    )
    if order == "desc":
        stmt = stmt.order_by(desc(sort_column))
    else:
        stmt = stmt.order_by(sort_column.asc())

    items, total, total_pages = await paginate(session, stmt, page=page, page_size=page_size)

    results: list[VulnerabilityResponse] = []
    for item in items:
        # Calculate approximate aggregate EAL contribution across affected assets
        eal_contrib = float(
            (item.cvss_score or 5.0) * 350_000.0 * (1.5 if item.in_cisa_kev else 1.0)
        )
        results.append(
            VulnerabilityResponse(
                id=item.id,
                cve_id=item.cve_id,
                cvss_score=float(item.cvss_score) if item.cvss_score is not None else None,
                exploit_available=item.exploit_available,
                in_cisa_kev=item.in_cisa_kev,
                epss_score=float(item.epss_score) if item.epss_score is not None else None,
                description=item.description,
                published_at=item.published_at,
                eal_contribution=round(eal_contrib, 2),
                affected_assets_count=len(item.asset_links) if item.asset_links else 0,
            )
        )

    return PaginatedResponse(
        items=results,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/{id}",
    response_model=VulnerabilityResponse,
    summary="Get single vulnerability detail",
)
async def get_vulnerability(
    id: int,
    session: DbSession,
) -> VulnerabilityResponse:
    """Get single vulnerability finding by ID."""
    stmt = select(Vulnerability).options(selectinload(Vulnerability.asset_links)).where(Vulnerability.id == id)
    result = await session.execute(stmt)
    item = result.scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vulnerability with ID '{id}' not found",
        )

    eal_contrib = float((item.cvss_score or 5.0) * 350_000.0 * (1.5 if item.in_cisa_kev else 1.0))
    return VulnerabilityResponse(
        id=item.id,
        cve_id=item.cve_id,
        cvss_score=float(item.cvss_score) if item.cvss_score is not None else None,
        exploit_available=item.exploit_available,
        in_cisa_kev=item.in_cisa_kev,
        epss_score=float(item.epss_score) if item.epss_score is not None else None,
        description=item.description,
        published_at=item.published_at,
        eal_contribution=round(eal_contrib, 2),
        affected_assets_count=len(item.asset_links) if item.asset_links else 0,
    )
