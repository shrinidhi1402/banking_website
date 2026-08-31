"""Event processing pipeline — business logic for real-time recompute (architecture §3.2)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from crq.core.logging import get_logger
from crq.models.asset import Asset
from crq.models.control import ControlAssessment
from crq.models.risk import EALSnapshot
from crq.notifications.ws_manager import ws_manager
from crq.risk_engine.fair import compute_eal
from crq.schemas.events import EventEnvelope

log = get_logger(__name__)


async def handle_control_event(
    event: EventEnvelope,
    session: AsyncSession,
) -> dict[str, Any]:
    """Handle control.disabled or control.updated events.

    1. Updates control effectiveness for the asset
    2. Triggers EAL recomputation
    3. Checks threshold delta and broadcasts live WebSocket invalidation
    """
    payload = event.payload
    control_key = payload.get("control", "mfa")
    asset_id_str = payload.get("asset_id")

    log.info(
        "processing_control_event",
        event_id=str(event.event_id),
        control=control_key,
        asset_id=asset_id_str,
    )

    # 1. Determine asset
    asset: Asset | None = None
    if asset_id_str:
        try:
            asset_uuid = uuid.UUID(asset_id_str)
            asset_stmt = select(Asset).where(Asset.id == asset_uuid)
            res = await session.execute(asset_stmt)
            asset = res.scalar_one_or_none()
        except ValueError:
            # Look up by name or external_id
            asset_stmt = select(Asset).where(
                (Asset.name == asset_id_str) | (Asset.external_id == asset_id_str)
            )
            res = await session.execute(asset_stmt)
            asset = res.scalar_one_or_none()

    # If no asset found in DB, create/use mock asset representation
    target_asset_id = asset.id if asset else uuid.uuid4()
    criticality = asset.criticality_score if asset else 9

    # 2. Control effectiveness calculation
    # If control was disabled, effectiveness drops from e.g. 0.95 -> 0.05
    is_disabled = "disabled" in event.event_type or payload.get("status") == "disabled"
    coverage = 0.0 if is_disabled else float(payload.get("coverage_pct", 95.0))
    quality = 0.0 if is_disabled else float(payload.get("config_quality", 0.95))
    effectiveness = round((coverage / 100.0) * quality, 4)

    # Record control assessment
    assessment = ControlAssessment(
        asset_id=target_asset_id,
        control_id=uuid.uuid4(),  # placeholder control uuid
        coverage_pct=coverage,
        config_quality=quality,
        freshness_days=0,
        effectiveness=effectiveness,
        assessed_at=datetime.now(UTC),
    )
    session.add(assessment)

    # 3. Trigger Risk Engine Recomputation for affected asset
    eal_result = await handle_risk_recompute(
        asset_id=target_asset_id,
        org_id=event.org_id,
        criticality_score=criticality,
        control_effectiveness=effectiveness,
        source_event_id=event.event_id,
        session=session,
    )

    return {
        "event_id": str(event.event_id),
        "control": control_key,
        "effectiveness": effectiveness,
        "new_eal": eal_result["new_eal"],
        "delta_pct": eal_result["delta_pct"],
        "threshold_alert": eal_result["threshold_alert"],
    }


async def handle_vuln_event(
    event: EventEnvelope,
    session: AsyncSession,
) -> dict[str, Any]:
    """Handle vuln.detected events and recompute asset EAL."""
    payload = event.payload
    cve_id = payload.get("cve_id", "CVE-UNKNOWN")
    cvss_score = float(payload.get("cvss_score", 7.5))
    asset_id_str = payload.get("asset_id")

    log.info("processing_vuln_event", cve_id=cve_id, cvss=cvss_score)

    target_asset_id = uuid.uuid4()
    if asset_id_str:
        try:
            target_asset_id = uuid.UUID(asset_id_str)
        except ValueError:
            pass

    # Recompute EAL with higher vuln count / threat
    eal_result = await handle_risk_recompute(
        asset_id=target_asset_id,
        org_id=event.org_id,
        criticality_score=8,
        active_vulns_count=4,
        source_event_id=event.event_id,
        session=session,
    )

    return {
        "event_id": str(event.event_id),
        "cve_id": cve_id,
        "new_eal": eal_result["new_eal"],
        "delta_pct": eal_result["delta_pct"],
        "threshold_alert": eal_result["threshold_alert"],
    }


async def handle_risk_recompute(
    asset_id: uuid.UUID,
    org_id: uuid.UUID,
    criticality_score: int = 7,
    control_effectiveness: float = 0.8,
    active_vulns_count: int = 2,
    source_event_id: uuid.UUID | None = None,
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Execute FAIR recompute, persist EAL snapshot, and check threshold alert."""
    # 1. Fetch previous baseline EAL if available
    previous_eal = 42_000_000.0  # default baseline
    if session is not None:
        last_snap_stmt = (
            select(EALSnapshot)
            .where(EALSnapshot.org_id == org_id)
            .order_by(desc(EALSnapshot.computed_at))
            .limit(1)
        )
        snap_res = await session.execute(last_snap_stmt)
        last_snap = snap_res.scalar_one_or_none()
        if last_snap is not None:
            previous_eal = float(last_snap.eal)

    # 2. Compute new EAL via FAIR engine
    computed = compute_eal(
        asset_id=asset_id,
        org_id=org_id,
        criticality_score=criticality_score,
        control_effectiveness=control_effectiveness,
        active_vulns_count=active_vulns_count,
    )
    new_eal = computed["eal"]

    # 3. Persist new EAL snapshot
    now = datetime.now(UTC)
    snapshot = EALSnapshot(
        org_id=org_id,
        scope="asset",
        scope_id=asset_id,
        eal=new_eal,
        var_95=computed["var_95"],
        var_99=computed["var_99"],
        loss_distribution=computed["loss_distribution"],
        calculation_version=computed["calculation_version"],
        inputs_hash=computed["inputs_hash"],
        computed_at=now,
        source_event_ids=[str(source_event_id)] if source_event_id else [],
    )
    if session is not None:
        session.add(snapshot)
        await session.flush()

    # 4. Threshold Monitor (architecture §3.2 step 5)
    delta_pct = (
        round(((new_eal - previous_eal) / previous_eal) * 100.0, 2) if previous_eal > 0 else 0.0
    )
    threshold_limit = 20.0  # Configurable threshold percentage
    threshold_alert = abs(delta_pct) >= threshold_limit

    if threshold_alert:
        log.warning(
            "eal_threshold_breach_detected",
            previous_eal=previous_eal,
            new_eal=new_eal,
            delta_pct=delta_pct,
            threshold_limit=threshold_limit,
        )

    # 5. Broadcast lightweight WebSocket invalidation signaling message (architecture §5.5)
    invalidation_message = {
        "topic": "eal.updated" if not threshold_alert else "risk.alert",
        "scope": "asset",
        "scope_id": str(asset_id),
        "org_id": str(org_id),
        "previous_eal": previous_eal,
        "new_eal": new_eal,
        "delta_pct": delta_pct,
        "threshold_alert": threshold_alert,
        "timestamp": now.isoformat(),
    }
    await ws_manager.broadcast_to_org(org_id=org_id, message=invalidation_message)

    return {
        "asset_id": str(asset_id),
        "previous_eal": previous_eal,
        "new_eal": new_eal,
        "delta_pct": delta_pct,
        "threshold_alert": threshold_alert,
    }
