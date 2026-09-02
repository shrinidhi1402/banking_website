"""Assets endpoints — B2.5 asset inventory, filtering, and pagination."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import desc, select

from crq.api.v1._utils import PaginatedResponse, paginate
from crq.core.db import DbSession
from crq.models.asset import Asset
from crq.schemas.asset import AssetCreateRequest, AssetResponse

router = APIRouter()


@router.get(
    "",
    response_model=PaginatedResponse[AssetResponse],
    summary="List inventory assets (paginated and filterable)",
)
async def list_assets(
    session: DbSession,
    criticality_min: int | None = Query(
        default=None, ge=1, le=10, description="Minimum asset criticality score (1-10)"
    ),
    business_unit_id: int | None = Query(
        default=None, description="Filter by business unit ID"
    ),
    environment: str | None = Query(
        default=None, description="Filter by environment (prod, staging, dev)"
    ),
    asset_type: str | None = Query(
        default=None, description="Filter by asset type (server, endpoint, database)"
    ),
    org_id: int = Query(default=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> PaginatedResponse[AssetResponse]:
    """Retrieve paginated assets with multi-parameter filtering."""
    stmt = select(Asset).where(Asset.org_id == org_id)

    if criticality_min is not None:
        stmt = stmt.where(Asset.criticality_score >= criticality_min)
    if business_unit_id is not None:
        stmt = stmt.where(Asset.business_unit_id == business_unit_id)
    if environment is not None:
        stmt = stmt.where(Asset.environment == environment)
    if asset_type is not None:
        stmt = stmt.where(Asset.asset_type == asset_type)

    stmt = stmt.order_by(desc(Asset.criticality_score), Asset.name)

    items, total, total_pages = await paginate(session, stmt, page=page, page_size=page_size)

    asset_responses = [
        AssetResponse(
            id=item.id,
            org_id=item.org_id,
            business_unit_id=item.business_unit_id,
            external_id=item.external_id,
            name=item.name,
            hostname=item.hostname,
            asset_type=item.asset_type,
            environment=item.environment,
            criticality_score=item.criticality_score,
            criticality_inputs=item.criticality_inputs,
            downtime_cost_per_hour=float(item.downtime_cost_per_hour)
            if item.downtime_cost_per_hour
            else 0.0,
            data_records_count=item.data_records_count,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]

    return PaginatedResponse(
        items=asset_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post(
    "",
    response_model=AssetResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new asset",
)
async def create_asset(
    payload: AssetCreateRequest,
    session: DbSession,
) -> AssetResponse:
    """Create a new asset in the inventory."""
    asset = Asset(
        org_id=payload.org_id,
        name=payload.name,
        business_unit_id=payload.business_unit_id,
        hostname=payload.hostname,
        asset_type=payload.asset_type,
        environment=payload.environment,
        criticality_score=payload.criticality_score,
        criticality_inputs=payload.criticality_inputs,
        downtime_cost_per_hour=payload.downtime_cost_per_hour,
        data_records_count=payload.data_records_count,
    )
    session.add(asset)
    await session.flush()
    await session.refresh(asset)

    return AssetResponse(
        id=asset.id,
        org_id=asset.org_id,
        business_unit_id=asset.business_unit_id,
        external_id=asset.external_id,
        name=asset.name,
        hostname=asset.hostname,
        asset_type=asset.asset_type,
        environment=asset.environment,
        criticality_score=asset.criticality_score,
        criticality_inputs=asset.criticality_inputs,
        downtime_cost_per_hour=float(asset.downtime_cost_per_hour)
        if asset.downtime_cost_per_hour
        else 0.0,
        data_records_count=asset.data_records_count,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


@router.get(
    "/{id}",
    response_model=AssetResponse,
    summary="Get single asset details",
)
async def get_asset(
    id: int,
    session: DbSession,
) -> AssetResponse:
    """Get single asset by ID."""
    stmt = select(Asset).where(Asset.id == id)
    result = await session.execute(stmt)
    asset = result.scalar_one_or_none()

    if asset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID '{id}' not found",
        )

    return AssetResponse(
        id=asset.id,
        org_id=asset.org_id,
        business_unit_id=asset.business_unit_id,
        external_id=asset.external_id,
        name=asset.name,
        hostname=asset.hostname,
        asset_type=asset.asset_type,
        environment=asset.environment,
        criticality_score=asset.criticality_score,
        criticality_inputs=asset.criticality_inputs,
        downtime_cost_per_hour=float(asset.downtime_cost_per_hour)
        if asset.downtime_cost_per_hour
        else 0.0,
        data_records_count=asset.data_records_count,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )
