"""Task: budget optimization."""

from crq.workers.celery_app import celery_app
from crq.optimizer.knapsack import optimize_budget
from crq.optimizer.rosi import compute_rosi

@celery_app.task(name="crq.optimize_budget")
def optimize_budget_task(budget: float, actions: list[dict]) -> dict:
    """Run knapsack budget optimizer in background."""
    res = optimize_budget(actions, budget)
    total_rosi = compute_rosi(res["total_eal_reduction"], res["total_cost"])
    res["total_rosi"] = round(total_rosi, 2)
    return res
