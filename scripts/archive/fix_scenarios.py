import re
filepath = r"src\crq\api\v1\scenarios.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Strip out the optimize route
content = re.sub(r'@router\.post\("/optimize"\).*$', '', content, flags=re.DOTALL)
content = re.sub(r'class BudgetOptimizationRequest.*?actions: list\[ActionRequest\]', '', content, flags=re.DOTALL)
content = content.replace("from crq.optimizer.knapsack import optimize_budget\nfrom crq.optimizer.rosi import compute_rosi\n", "")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
