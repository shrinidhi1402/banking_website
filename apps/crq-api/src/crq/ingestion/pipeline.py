"""Event processing pipeline — business logic for real-time recompute (architecture §3.2)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from crq.core.logging import get_logger
from crq.models.asset import Asset
from crq.models.control import ControlAssessment, Control
from crq.models.risk import EalSnapshot
from crq.models.vuln import AssetVulnerability, Vulnerability
from crq.notifications.ws_manager import ws_manager
from crq.risk_engine.fair import compute_eal
from crq.schemas.events import EventEnvelope

log = get_logger(__name__)

# Fixed org UUID used for org-scope EAL snapshots (matches the seed row).
ORG_SCOPE_UUID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _resolve_asset_id(asset_id_val: Any, session: AsyncSession) -> int:
    """Resolve an asset reference (numeric id, name, external_id or hostname) to a row id."""
    if asset_id_val is None:
        return 1
    try:
        return int(asset_id_val)
    except (TypeError, ValueError):
        stmt = select(Asset).where(
            (Asset.name == str(asset_id_val))
            | (Asset.external_id == str(asset_id_val))
            | (Asset.hostname == str(asset_id_val))
        )
        res = await session.execute(stmt)
        asset = res.scalar_one_or_none()
        return asset.id if asset else 1


async def _upsert_vulnerability(payload: dict[str, Any], asset_id: int, session: AsyncSession) -> None:
    """Create/refresh a crq_vulnerabilities row + asset link so the finding shows up
    in /risk/contributors and /vulnerabilities."""
    cve = payload.get("cve_id") or payload.get("vulnerability_id") or "BANK-UNKNOWN"
    cvss = payload.get("cvss_score")
    desc = payload.get("description") or payload.get("title")

    res = await session.execute(select(Vulnerability).where(Vulnerability.cve_id == cve))
    vuln = res.scalar_one_or_none()
    if vuln is None:
        vuln = Vulnerability(
            cve_id=cve,
            title=desc,
            description=desc,
            cvss_score=float(cvss) if cvss is not None else None,
            exploit_available=True,
        )
        session.add(vuln)
        await session.flush()
    else:
        if cvss is not None:
            vuln.cvss_score = float(cvss)
        if desc:
            vuln.description = desc

    link_res = await session.execute(
        select(AssetVulnerability).where(
            AssetVulnerability.asset_id == asset_id,
            AssetVulnerability.vulnerability_id == vuln.id,
        )
    )
    link = link_res.scalar_one_or_none()
    if link is None:
        session.add(AssetVulnerability(asset_id=asset_id, vulnerability_id=vuln.id, status="open"))
    else:
        link.status = "open"
    await session.flush()


async def _resolve_vulnerability(payload: dict[str, Any], session: AsyncSession) -> None:
    """Remove a previously-recorded finding (cascade drops its asset links)."""
    cve = payload.get("cve_id") or payload.get("vulnerability_id")
    if not cve:
        return
    res = await session.execute(select(Vulnerability).where(Vulnerability.cve_id == cve))
    vuln = res.scalar_one_or_none()
    if vuln is not None:
        await session.delete(vuln)
        await session.flush()


async def _write_org_rollup(org_id: int, session: AsyncSession) -> float:
    """Aggregate the latest per-asset EAL into an org-scope snapshot so the
    portfolio headline reflects asset-level changes."""
    assets_res = await session.execute(select(Asset).where(Asset.org_id == org_id))
    assets = list(assets_res.scalars().all())

    total_eal = total_v95 = total_v99 = 0.0
    for asset in assets:
        snap_stmt = (
            select(EalSnapshot)
            .where(
                EalSnapshot.org_id == org_id,
                EalSnapshot.scope == "asset",
                EalSnapshot.scope_id == asset.uuid,
            )
            .order_by(desc(EalSnapshot.computed_at))
            .limit(1)
        )
        snap = (await session.execute(snap_stmt)).scalar_one_or_none()
        if snap is not None:
            total_eal += float(snap.eal)
            total_v95 += float(snap.var_95 or snap.eal * 1.85)
            total_v99 += float(snap.var_99 or snap.eal * 2.40)
        else:
            calc = compute_eal(
                asset_id=asset.id, org_id=org_id, criticality_score=asset.criticality_score
            )
            total_eal += calc["eal"]
            total_v95 += calc["var_95"]
            total_v99 += calc["var_99"]

    session.add(
        EalSnapshot(
            org_id=org_id,
            scope="org",
            scope_id=ORG_SCOPE_UUID,
            eal=round(total_eal, 2),
            var_95=round(total_v95, 2),
            var_99=round(total_v99, 2),
            loss_distribution={
                "p10": round(total_eal * 0.4, 2),
                "p50": round(total_eal, 2),
                "p90": round(total_eal * 1.9, 2),
            },
            calculation_version="1.0-rollup",
            inputs_hash="org_rollup",
            computed_at=datetime.now(UTC),
            source_event_ids=[],
        )
    )
    await session.flush()
    return round(total_eal, 2)


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
    asset_id_val = payload.get("asset_id")

    log.info(
        "processing_control_event",
        event_id=str(event.event_id),
        control=control_key,
        asset_id=asset_id_val,
    )

    # 1. Determine asset
    asset: Asset | None = None
    if asset_id_val:
        try:
            asset_id_int = int(asset_id_val)
            asset_stmt = select(Asset).where(Asset.id == asset_id_int)
            res = await session.execute(asset_stmt)
            asset = res.scalar_one_or_none()
        except ValueError:
            # Look up by name or external_id or hostname
            asset_stmt = select(Asset).where(
                (Asset.name == str(asset_id_val)) | 
                (Asset.external_id == str(asset_id_val)) |
                (Asset.hostname == str(asset_id_val))
            )
            res = await session.execute(asset_stmt)
            asset = res.scalar_one_or_none()

    target_asset_id = asset.id if asset else 1
    criticality = asset.criticality_score if asset else 9

    # Look up control
    control_stmt = select(Control).where(Control.key == control_key)
    res = await session.execute(control_stmt)
    control = res.scalar_one_or_none()
    target_control_id = control.id if control else 1

    # 2. Control effectiveness calculation
    is_disabled = "disabled" in event.event_type or payload.get("status") == "disabled"
    coverage = 0.0 if is_disabled else float(payload.get("coverage_pct", 95.0))
    quality = 0.0 if is_disabled else float(payload.get("config_quality", 0.95))
    effectiveness = round((coverage / 100.0) * quality, 4)

    # Record control assessment
    assessment = ControlAssessment(
        asset_id=target_asset_id,
        control_id=target_control_id,
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
    """Handle vuln.detected / vuln.resolved events and recompute asset EAL."""
    payload = event.payload
    cve_id = payload.get("cve_id", payload.get("vulnerability_id", "CVE-UNKNOWN"))
    cvss_score = float(payload.get("cvss_score", 7.5))
    is_resolved = event.event_type.endswith(".resolved")

    log.info(
        "processing_vuln_event", cve_id=cve_id, cvss=cvss_score, resolved=is_resolved
    )

    target_asset_id = await _resolve_asset_id(payload.get("asset_id"), session)

    # Keep the vulnerability backlog in sync so it surfaces in /risk/contributors.
    if is_resolved:
        await _resolve_vulnerability(payload, session)
    else:
        await _upsert_vulnerability(payload, target_asset_id, session)

    # A resolved finding lowers exposure; a new one raises it.
    eal_result = await handle_risk_recompute(
        asset_id=target_asset_id,
        org_id=event.org_id,
        criticality_score=6 if is_resolved else 8,
        active_vulns_count=1 if is_resolved else 4,
        source_event_id=event.event_id,
        session=session,
    )

    return {
        "event_id": str(event.event_id),
        "cve_id": cve_id,
        "resolved": is_resolved,
        "new_eal": eal_result["new_eal"],
        "delta_pct": eal_result["delta_pct"],
        "threshold_alert": eal_result["threshold_alert"],
    }


async def handle_risk_recompute(
    asset_id: int,
    org_id: int,
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
            select(EalSnapshot)
            .where(EalSnapshot.org_id == org_id)
            .order_by(desc(EalSnapshot.computed_at))
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
    
    # We must fetch the asset UUID to satisfy scope_id=UUID constraint
    asset_uuid = uuid.uuid4()
    if session is not None:
        asset_stmt = select(Asset).where(Asset.id == asset_id)
        res = await session.execute(asset_stmt)
        asset = res.scalar_one_or_none()
        if asset:
            asset_uuid = asset.uuid

    snapshot = EalSnapshot(
        org_id=org_id,
        scope="asset",
        scope_id=asset_uuid,
        eal=new_eal,
        var_95=computed["var_95"],
        var_99=computed["var_99"],
        loss_distribution=computed["loss_distribution"],
        calculation_version=computed["calculation_version"],
        inputs_hash=computed["inputs_hash"],
        computed_at=now,
        source_event_ids=[str(source_event_id)] if source_event_id else [],
    )
    org_eal: float | None = None
    if session is not None:
        session.add(snapshot)
        await session.flush()
        # Roll the new per-asset figure up into an org-scope snapshot so the
        # portfolio headline (GET /risk/summary?scope=org) reflects the change.
        org_eal = await _write_org_rollup(org_id, session)

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
        "scope_id": str(asset_uuid),
        "org_id": str(org_id),
        "previous_eal": previous_eal,
        "new_eal": new_eal,
        "org_eal": org_eal,
        "delta_pct": delta_pct,
        "threshold_alert": threshold_alert,
        "timestamp": now.isoformat(),
    }
    await ws_manager.broadcast_to_org(org_id=str(org_id), message=invalidation_message)

    return {
        "asset_id": str(asset_id),
        "previous_eal": previous_eal,
        "new_eal": new_eal,
        "org_eal": org_eal,
        "delta_pct": delta_pct,
        "threshold_alert": threshold_alert,
    }
