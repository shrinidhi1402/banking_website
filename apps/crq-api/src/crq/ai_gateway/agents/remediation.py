"""LangGraph Remediation Agent for autonomous risk fixing strategies."""

import json
from typing import Annotated, Sequence, TypedDict
import operator

try:
    from langgraph.graph import StateGraph, END
except ImportError:
    pass # Will be installed

from crq.ai_gateway.client import llm_client
from crq.core.logging import get_logger

log = get_logger(__name__)

class AgentState(TypedDict):
    """State passing through the LangGraph remediation agent."""
    messages: Annotated[Sequence[dict], operator.add]
    budget: float
    current_eal: float
    proposed_actions: list[dict]
    iteration: int

SYSTEM_PROMPT = """
You are an autonomous CRQ Remediation Agent. Your goal is to construct a step-by-step 
plan to reduce the Expected Annual Loss (EAL) without exceeding the provided budget.

You can select actions. Respond with a JSON object describing the chosen actions:
{
  "rationale": "Why you chose this",
  "actions": [ {"type": "patch", "cost": 15000} ]
}
"""

async def plan_node(state: AgentState):
    """The agent generates a plan."""
    messages = state["messages"]
    if not any(m["role"] == "system" for m in messages):
        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages
        
    response = await llm_client.complete(
        messages, 
        temperature=0.2, 
        json_mode=True
    )
    
    try:
        plan_data = json.loads(response)
        proposed_actions = plan_data.get("actions", [])
    except json.JSONDecodeError:
        proposed_actions = []
        
    return {
        "messages": [{"role": "assistant", "content": response}],
        "proposed_actions": proposed_actions,
        "iteration": state["iteration"] + 1
    }

async def check_budget_node(state: AgentState):
    """Safety rail node: verify the proposed plan doesn't exceed budget."""
    actions = state["proposed_actions"]
    total_cost = sum(a.get("cost", 0) for a in actions)
    
    if total_cost > state["budget"]:
        correction = f"Your plan costs {total_cost}, which exceeds the budget of {state['budget']}. Try again."
        return {"messages": [{"role": "user", "content": correction}]}
        
    return {"messages": []} # Approved

def should_continue(state: AgentState):
    """Conditional edge router."""
    if state["iteration"] >= 5:
        return END
        
    last_msg = state["messages"][-1]
    if last_msg["role"] == "user" and "exceeds the budget" in last_msg["content"]:
        return "plan"
        
    return END

def build_remediation_graph():
    """Build the LangGraph state machine."""
    workflow = StateGraph(AgentState)
    
    workflow.add_node("plan", plan_node)
    workflow.add_node("check_budget", check_budget_node)
    
    workflow.set_entry_point("plan")
    workflow.add_edge("plan", "check_budget")
    workflow.add_conditional_edges("check_budget", should_continue)
    
    return workflow.compile()
