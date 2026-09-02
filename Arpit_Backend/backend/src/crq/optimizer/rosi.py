"""Return on Security Investment (ROSI) calculator."""

def compute_rosi(eal_reduction: float, cost: float) -> float:
    """
    ROSI = (EAL Reduction - Cost) / Cost
    
    If ROSI is > 0, the investment saves more than it costs.
    If ROSI is < 0, the investment costs more than the risk it mitigates.
    """
    if cost <= 0:
        return float('inf') if eal_reduction > 0 else 0.0
        
    return (eal_reduction - cost) / cost


def sort_by_rosi(actions: list[dict]) -> list[dict]:
    """
    Greedy fallback: rank actions purely by ROSI descending.
    Useful for very large datasets where DP knapsack is too slow.
    """
    for a in actions:
        a["rosi"] = compute_rosi(a.get("eal_reduction", 0), a.get("cost", 0))
        
    return sorted(actions, key=lambda x: x["rosi"], reverse=True)
