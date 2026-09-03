"""Grounding validator to prevent LLM hallucinations."""

import re
from typing import Any
from pydantic import BaseModel

from crq.core.logging import get_logger

log = get_logger(__name__)

class ValidationResult(BaseModel):
    valid: bool
    unsupported_claims: list[str]
    action: str  # "pass", "regenerate", "fail_closed"

def extract_numeric_claims(text: str) -> list[str]:
    """Extract numbers, currency, percentages for validation."""
    claims = []
    # E.g., ₹4.2 Cr, 42,000,000, 95%, 4
    money_pattern = r'₹?\d+(?:,\d+)*(?:\.\d+)?(?:\s*[KkMmBbCcrR]+)?'
    pct_pattern = r'\d+(?:\.\d+)?%'
    
    for match in re.findall(money_pattern, text):
        claims.append(match)
    for match in re.findall(pct_pattern, text):
        claims.append(match)
        
    return claims

def extract_named_entities(text: str) -> list[str]:
    """Extract CVEs and UUID-like or specific patterns."""
    claims = []
    cve_pattern = r'CVE-\d{4}-\d+'
    for match in re.findall(cve_pattern, text):
        claims.append(match)
    return claims

def validate_grounding(response_text: str, context_data: dict | str) -> ValidationResult:
    """
    Ensure the LLM response doesn't hallucinate numbers or CVEs not in context.
    """
    context_str = str(context_data)
    
    num_claims = extract_numeric_claims(response_text)
    entity_claims = extract_named_entities(response_text)
    
    unsupported = []
    
    for claim in num_claims + entity_claims:
        # Fuzzy/exact check. If the exact string isn't in context, it's suspect.
        # For a production system, you'd normalize numbers (e.g. ₹4.2 Cr == 42000000)
        # Here we do a simple string match.
        clean_claim = claim.replace("₹", "").strip()
        if clean_claim not in context_str and claim not in context_str:
            unsupported.append(claim)
            
    if unsupported:
        log.warning("grounding_failure_detected", unsupported=unsupported)
        return ValidationResult(
            valid=False,
            unsupported_claims=unsupported,
            action="regenerate"
        )
        
    return ValidationResult(
        valid=True,
        unsupported_claims=[],
        action="pass"
    )
