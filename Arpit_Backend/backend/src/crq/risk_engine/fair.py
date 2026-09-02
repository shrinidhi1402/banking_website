"""FAIR risk calculation engine."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from crq.risk_engine.monte_carlo import run_simulation


def compute_eal(
    asset_id: int | str,
    org_id: int | str,
    criticality_score: int = 5,
    control_effectiveness: float = 0.8,
    active_vulns_count: int = 2,
    threat_frequency: float = 1.2,
) -> dict[str, Any]:
    """
    Compute Expected Annual Loss (EAL) and VaR metrics using full Monte Carlo.
    
    Derives PERT distribution inputs dynamically from asset context:
    - Threat Event Frequency (TEF) scales by threat_frequency
    - Vulnerability (Susceptibility) inversely scales by control_effectiveness
    - Loss Magnitude scales heavily by criticality_score
    """
    # 1. Threat Event Frequency (Events per year)
    tef_min = max(0.1, threat_frequency * 0.5)
    tef_mode = threat_frequency
    tef_max = threat_frequency * 2.0
    
    # 2. Vulnerability (0.0 to 1.0 probability of success if attacked)
    # Higher control effectiveness = lower vulnerability
    base_vuln = 1.0 - control_effectiveness
    # More open vulnerabilities = higher susceptibility multiplier
    vuln_multiplier = 1.0 + (active_vulns_count * 0.1)
    
    vuln_mode = min(0.95, max(0.01, base_vuln * vuln_multiplier))
    vuln_min = max(0.01, vuln_mode * 0.5)
    vuln_max = min(0.99, vuln_mode * 1.5)
    
    # 3. Loss Magnitude (Financial impact)
    # Scales non-linearly with criticality (1-10)
    base_loss = (criticality_score ** 2) * 10_000.0  # E.g., crit 5 = 250k, crit 10 = 1M
    
    loss_min = base_loss * 0.5
    loss_mode = base_loss
    loss_max = base_loss * 2.5
    
    # Run 10,000 iteration Monte Carlo simulation
    results = run_simulation(
        tef_min, tef_mode, tef_max,
        vuln_min, vuln_mode, vuln_max,
        loss_min, loss_mode, loss_max,
        iterations=10_000
    )
    
    # Provenance hashing
    inputs = {
        "asset_id": str(asset_id),
        "org_id": str(org_id),
        "criticality_score": criticality_score,
        "control_effectiveness": control_effectiveness,
        "active_vulns_count": active_vulns_count,
        "threat_frequency": threat_frequency,
    }
    inputs_hash = hashlib.sha256(json.dumps(inputs, sort_keys=True).encode()).hexdigest()

    return {
        "asset_id": str(asset_id),
        "org_id": str(org_id),
        "eal": round(results["eal"], 2),
        "var_95": round(results["var_95"], 2),
        "var_99": round(results["var_99"], 2),
        "loss_distribution": {k: round(v, 2) for k, v in results["loss_distribution"].items()},
        "calculation_version": "1.0",
        "inputs_hash": inputs_hash,
        "computed_at": datetime.now(UTC),
    }
