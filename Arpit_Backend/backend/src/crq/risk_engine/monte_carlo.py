"""Monte Carlo simulation engine for FAIR (Factor Analysis of Information Risk)."""

import numpy as np
from crq.risk_engine.distributions import sample_pert

def run_simulation(
    threat_event_freq_min: float,
    threat_event_freq_mode: float,
    threat_event_freq_max: float,
    vuln_min: float,
    vuln_mode: float,
    vuln_max: float,
    loss_magnitude_min: float,
    loss_magnitude_mode: float,
    loss_magnitude_max: float,
    iterations: int = 10_000
) -> dict:
    """
    Run a full FAIR Monte Carlo simulation.
    
    1. Sample Threat Event Frequency (TEF)
    2. Sample Vulnerability (Susceptibility)
    3. Calculate Loss Event Frequency (LEF) = TEF * Vuln
    4. Sample Primary Loss Magnitude (PLM)
    5. Calculate Expected Loss = LEF * PLM
    """
    # 1. Sample TEF (Events per year)
    tef_samples = sample_pert(threat_event_freq_min, threat_event_freq_mode, threat_event_freq_max, iterations)
    
    # 2. Sample Vulnerability (Probability of success 0-1)
    vuln_samples = sample_pert(vuln_min, vuln_mode, vuln_max, iterations)
    
    # 3. Calculate LEF
    lef_samples = tef_samples * vuln_samples
    
    # 4. Sample Loss Magnitude (Financial impact)
    loss_samples = sample_pert(loss_magnitude_min, loss_magnitude_mode, loss_magnitude_max, iterations)
    
    # 5. Calculate Annualized Loss
    annualized_loss = lef_samples * loss_samples
    
    # Compute aggregates
    eal = float(np.mean(annualized_loss))
    var_95 = float(np.percentile(annualized_loss, 95))
    var_99 = float(np.percentile(annualized_loss, 99))
    
    loss_distribution = {
        "p10": float(np.percentile(annualized_loss, 10)),
        "p25": float(np.percentile(annualized_loss, 25)),
        "p50": float(np.percentile(annualized_loss, 50)),
        "p75": float(np.percentile(annualized_loss, 75)),
        "p90": float(np.percentile(annualized_loss, 90)),
        "p95": var_95,
        "p99": var_99,
    }
    
    return {
        "eal": eal,
        "var_95": var_95,
        "var_99": var_99,
        "loss_distribution": loss_distribution,
    }
