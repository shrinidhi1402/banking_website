"""0/1 Knapsack optimizer for budget allocation (architecture §4.4)."""

from typing import Any

def optimize_budget(
    actions: list[dict[str, Any]], 
    budget: float
) -> dict[str, Any]:
    """
    Select the optimal subset of remediation actions that maximizes EAL reduction 
    without exceeding the budget.
    
    Uses dynamic programming for the 0/1 knapsack problem (applicable for MVP scale).
    actions format: [{"id": "act1", "cost": 10000, "eal_reduction": 500000}, ...]
    """
    # Filter out actions that cost more than the total budget or have 0/negative reduction
    valid_actions = [a for a in actions if a["cost"] <= budget and a["eal_reduction"] > 0]
    
    # DP array setup
    n = len(valid_actions)
    
    # We map budget to discrete increments to make DP feasible. 
    # Let's say step size is 1000 INR to keep matrix size manageable
    step = 1000.0
    discrete_budget = int(budget / step)
    
    dp = [[0.0 for _ in range(discrete_budget + 1)] for _ in range(n + 1)]
    
    # Build DP table
    for i in range(1, n + 1):
        action = valid_actions[i - 1]
        cost_w = int(action["cost"] / step)
        val = float(action["eal_reduction"])
        
        for w in range(1, discrete_budget + 1):
            if cost_w <= w:
                dp[i][w] = max(dp[i - 1][w], val + dp[i - 1][w - cost_w])
            else:
                dp[i][w] = dp[i - 1][w]
                
    # Traceback to find selected actions
    selected_actions = []
    w = discrete_budget
    total_cost = 0.0
    total_reduction = 0.0
    
    for i in range(n, 0, -1):
        if dp[i][w] != dp[i - 1][w]:
            action = valid_actions[i - 1]
            selected_actions.append(action)
            w -= int(action["cost"] / step)
            total_cost += action["cost"]
            total_reduction += action["eal_reduction"]
            
    return {
        "budget": budget,
        "total_cost": total_cost,
        "total_eal_reduction": total_reduction,
        "selected_actions": selected_actions
    }
