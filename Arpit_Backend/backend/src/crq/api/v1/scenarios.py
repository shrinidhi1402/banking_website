"""Scenarios API Endpoints."""

from typing import Any
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from crq.core.db import DbSession
from crq.scenario.simulator import simulate_actions

router = APIRouter()

class ActionRequest(BaseModel):
    id: str
    type: str
    effectiveness_delta: float | None = None
    vulns_removed: int | None = None
    cost: float | None = None

class ScenarioRequest(BaseModel):
    asset_id: int
    org_id: int
    baseline_criticality: int = 7
    baseline_control_effectiveness: float = 0.5
    baseline_vulns_count: int = 5
    actions: list[ActionRequest]
    


@router.post("/simulate")
async def run_simulation(req: ScenarioRequest) -> dict[str, Any]:
    """Run what-if scenario simulator on asset risk."""
    return simulate_actions(
        asset_id=req.asset_id,
        org_id=req.org_id,
        baseline_criticality=req.baseline_criticality,
        baseline_control_effectiveness=req.baseline_control_effectiveness,
        baseline_vulns_count=req.baseline_vulns_count,
        actions=[a.model_dump() for a in req.actions]
    )

