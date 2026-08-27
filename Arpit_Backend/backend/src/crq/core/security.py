"""Security utilities — shared cryptographic helpers.

B0.1 stub — expanded in B0.3 (JWT verification) and B5.4 (hardening).
"""

from __future__ import annotations

import hashlib
import secrets


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random URL-safe token."""
    return secrets.token_urlsafe(length)


def hash_inputs(data: dict[str, object]) -> str:
    """Return a stable SHA-256 hex digest of a dict of FAIR inputs.

    Used to populate EAL snapshot `inputs_hash` for provenance tracking
    (architecture §6.6 — every EAL number must be traceable).
    """
    import json

    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode()).hexdigest()
