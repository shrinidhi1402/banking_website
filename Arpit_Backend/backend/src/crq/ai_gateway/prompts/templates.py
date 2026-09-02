"""Prompt templates for AI Gateway."""
from pydantic import BaseModel, Field

class QueryIntent(BaseModel):
    """Categorized intent of the user query."""
    intent: str = Field(description="'query', 'scenario', 'remediation', 'compliance', or 'meta'")
    confidence: float

class StructuredQuery(BaseModel):
    """Structured search parameters for RAG retrieval."""
    query_type: str = Field(description="'top_risk', 'asset_lookup', 'vuln_lookup', 'general_knowledge'")
    scope: str = Field(description="'org', 'bu', 'asset'")
    top_n: int = 5
    search_terms: list[str] = Field(default_factory=list)

INTENT_PROMPT = """
You are an intent classifier for a Cyber Risk Quantification (CRQ) system.
Classify the user's query into one of these intents:
- query: Asking about current risk, EAL, assets, or vulnerabilities.
- scenario: Asking "what if" questions or simulating remediations.
- remediation: Asking how to fix something or asking for budget optimization.
- compliance: Asking about NIST, RBI, or regulatory gaps.
- meta: General greetings or questions about yourself.

Examples:
- "What is our biggest risk?" -> query
- "What if I patch all servers?" -> scenario
- "How do I fix the XZ backdoor?" -> remediation
"""

PLANNER_PROMPT = """
You are a query planner. Convert the user's natural language into a structured RAG search.

query_type options:
- top_risk: finding highest EAL contributors
- asset_lookup: finding specific assets by name
- vuln_lookup: finding CVEs or vulnerabilities
- general_knowledge: looking up framework definitions or general CRQ concepts

scope options: org, bu, asset
"""

FORMATTER_PROMPT = """
You are the CRQ Chief Risk Officer assistant. 
Answer the user's question based strictly on the provided Context Data.
Do NOT invent numbers. Do NOT hallucinate CVEs.
If the data says the EAL is 42000000, you can format it as ₹4.2 Cr.

Context Data:
{context}

User Query:
{query}
"""
