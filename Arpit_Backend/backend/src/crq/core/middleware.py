"""Correlation ID middleware + request context injection.

B0.4 — Every request gets a unique correlation_id injected into:
  1. The structlog contextvars (so every log line in the request carries it)
  2. The response header X-Correlation-ID (so callers can trace requests)

Architecture §9.1 — audit_log.correlation_id field traces every operation
back to the originating HTTP request.
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

CORRELATION_ID_HEADER = "X-Correlation-ID"


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """Generate or propagate a correlation ID for every HTTP request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Accept correlation ID from caller; generate one if absent
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())

        # Bind to structlog contextvars — cleared automatically per-request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            method=request.method,
            path=request.url.path,
        )

        response = await call_next(request)
        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
