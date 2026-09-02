"""What-if scenario simulator (architecture §4.4)."""

from typing import Any
import copy

from crq.risk_engine.fair import compute_eal

def simulate_actions(
    asset_id: int,
    org_id: int,
    baseline_criticality: int,
    baseline_control_effectiveness: float,
    baseline_vulns_count: int,
    actions: list[dict[str, Any]]
) -> dict[str, Any]:
    """
    Run FAIR Monte Carlo before and after applying hypothetical actions.
    
    actions: list of dicts like:
    [
        {"type": "control.upgrade", "effectiveness_delta": +0.15},
        {"type": "vuln.patch", "vulns_removed": 2}
    ]
    """
    # 1. Baseline calculation
    baseline = compute_eal(
        asset_id=asset_id,
        org_id=org_id,
        criticality_score=baseline_criticality,
        control_effectiveness=baseline_control_effectiveness,
        active_vulns_count=baseline_vulns_count
    )
    
    # 2. Apply hypothetical actions to parameters
    new_effectiveness = baseline_control_effectiveness
    new_vulns_count = baseline_vulns_count
    
    for action in actions:
        action_type = action.get("type")
        if action_type == "control.upgrade":
            new_effectiveness = min(0.99, new_effectiveness + float(action.get("effectiveness_delta", 0.1)))
        elif action_type == "vuln.patch":
            new_vulns_count = max(0, new_vulns_count - int(action.get("vulns_removed", 1)))
            
    # 3. Post-action calculation
    simulated = compute_eal(
        asset_id=asset_id,
        org_id=org_id,
        criticality_score=baseline_criticality,
        control_effectiveness=new_effectiveness,
        active_vulns_count=new_vulns_count
    )
    
    eal_reduction = baseline["eal"] - simulated["eal"]
    
    return {
        "asset_id": asset_id,
        "baseline_eal": baseline["eal"],
        "simulated_eal": simulated["eal"],
        "eal_reduction": eal_reduction,
        "delta_pct": round((eal_reduction / baseline["eal"]) * 100, 2) if baseline["eal"] > 0 else 0.0,
        "actions_applied": actions,
        "post_simulation_params": {
            "control_effectiveness": new_effectiveness,
            "active_vulns_count": new_vulns_count
        }
    }
