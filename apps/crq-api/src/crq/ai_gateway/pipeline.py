"""NL Query Pipeline Orchestrator."""

from sqlalchemy.ext.asyncio import AsyncSession
import json

from crq.ai_gateway.client import llm_client
from crq.ai_gateway.grounding import validate_grounding
from crq.ai_gateway.prompts.templates import (
    INTENT_PROMPT, 
    PLANNER_PROMPT, 
    FORMATTER_PROMPT,
    QueryIntent,
    StructuredQuery
)
from crq.query_engine.retrieval import execute_retrieval
from crq.core.logging import get_logger

log = get_logger(__name__)

async def orchestrate_query(user_query: str, session: AsyncSession) -> dict:
    """Full RAG Pipeline."""
    
    # 1. Intent Classification
    intent_msg = [
        {"role": "system", "content": INTENT_PROMPT},
        {"role": "user", "content": user_query}
    ]
    intent_res = await llm_client.complete_structured(intent_msg, QueryIntent)
    
    log.info("query_intent_classified", intent=intent_res.intent, confidence=intent_res.confidence)
    
    # Fast path for meta
    if intent_res.intent == "meta":
        return {"answer": "I am the CRQ AI Assistant. How can I help you quantify risk today?", "context": {}}
        
    # 2. Query Planning
    planner_msg = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": user_query}
    ]
    plan_res = await llm_client.complete_structured(planner_msg, StructuredQuery)
    
    # 3. Retrieval
    context_data = await execute_retrieval(plan_res, session)
    context_str = json.dumps(context_data, default=str)
    
    # 4. Formatting & Grounding Loop
    system_content = FORMATTER_PROMPT.format(context=context_str, query=user_query)
    messages = [{"role": "system", "content": system_content}, {"role": "user", "content": user_query}]
    
    max_retries = 2
    final_answer = ""
    
    for attempt in range(max_retries):
        final_answer = await llm_client.complete(messages, temperature=0.1)
        
        # Grounding validation
        val_result = validate_grounding(final_answer, context_str)
        
        if val_result.valid:
            break
            
        log.warning("grounding_retry", attempt=attempt, unsupported=val_result.unsupported_claims)
        correction = f"Your previous answer contained unsupported numbers/entities: {val_result.unsupported_claims}. Please stick STRICTLY to the context."
        messages.append({"role": "assistant", "content": final_answer})
        messages.append({"role": "user", "content": correction})
        
    return {
        "answer": final_answer,
        "context": context_data,
        "plan": plan_res.model_dump()
    }
