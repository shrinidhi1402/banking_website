# STUB: replace with real B1.3 FAIR engine
"""FAIR risk calculation engine stub (to be replaced by full B1.3 FAIR engine)."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any


def compute_eal(
    asset_id: uuid.UUID | str,
    org_id: uuid.UUID | str,
    criticality_score: int = 5,
    control_effectiveness: float = 0.8,
    active_vulns_count: int = 2,
    threat_frequency: float = 1.2,
) -> dict[str, Any]:
    """Compute Expected Annual Loss (EAL) and VaR metrics (stub for B1.3).

    Formula approximation:
      LEF = Threat Event Frequency * (1.0 - control_effectiveness * 0.7) * (active_vulns_count * 0.5)
      LM = Criticality * 1,000,000 INR (base loss magnitude)
      EAL = LEF * LM
    """
    # Deterministic calculation based on inputs
    effective_vuln_factor = max(0.2, active_vulns_count * 0.4)
    vuln_prob = max(0.05, min(0.99, (1.0 - (control_effectiveness * 0.8)) * effective_vuln_factor))
    lef = threat_frequency * vuln_prob

    primary_loss = criticality_score * 500_000.0
    secondary_loss = criticality_score * 750_000.0
    loss_magnitude = primary_loss + secondary_loss

    calculated_eal = round(lef * loss_magnitude, 2)
    var_95 = round(calculated_eal * 1.85, 2)
    var_99 = round(calculated_eal * 2.40, 2)

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
        "eal": calculated_eal,
        "var_95": var_95,
        "var_99": var_99,
        "loss_distribution": {
            "p10": round(calculated_eal * 0.3, 2),
            "p50": round(calculated_eal * 0.85, 2),
            "p90": round(calculated_eal * 1.6, 2),
            "p95": var_95,
            "p99": var_99,
        },
        "calculation_version": "0.1.0-stub",
        "inputs_hash": inputs_hash,
        "computed_at": datetime.now(UTC),
    }
