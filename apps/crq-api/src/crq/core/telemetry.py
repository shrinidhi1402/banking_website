"""OpenTelemetry instrumentation + Prometheus metrics endpoint.

B0.4 — Observability foundation.

- FastAPI auto-instrumentation (spans for every request)
- SQLAlchemy async auto-instrumentation (spans for DB queries)
- Redis instrumentation
- OTLP exporter → Tempo
- prometheus-client /metrics endpoint (scraped by Prometheus)
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import prometheus_client
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from starlette.requests import Request
from starlette.responses import Response

if TYPE_CHECKING:
    from crq.core.config import Settings

# ---------------------------------------------------------------------------
# Prometheus registry & metrics
# ---------------------------------------------------------------------------
# Use the default registry so prometheus_client.generate_latest() works.
REQUEST_COUNT = prometheus_client.Counter(
    "crq_http_requests_total",
    "Total HTTP request count",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = prometheus_client.Histogram(
    "crq_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
)

EAL_COMPUTE_DURATION = prometheus_client.Histogram(
    "crq_eal_compute_duration_seconds",
    "FAIR/Monte Carlo EAL computation latency",
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60],
)

ACTIVE_WEBSOCKET_CONNECTIONS = prometheus_client.Gauge(
    "crq_websocket_connections_active",
    "Number of active WebSocket connections",
)


def configure_telemetry(settings: Settings) -> None:
    """Set up OpenTelemetry tracing.  Call once at app startup."""
    if not settings.OTEL_ENABLED:
        return

    resource = Resource.create(
        {
            "service.name": settings.OTEL_SERVICE_NAME,
            "service.version": settings.APP_VERSION,
        }
    )

    provider = TracerProvider(resource=resource)

    otlp_exporter = OTLPSpanExporter(
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        insecure=True,  # TLS handled by nginx/service mesh in prod
    )
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))

    trace.set_tracer_provider(provider)

    # Auto-instrumentation
    FastAPIInstrumentor().instrument()
    SQLAlchemyInstrumentor().instrument()
    RedisInstrumentor().instrument()


async def metrics_endpoint(request: Request) -> Response:
    """Expose Prometheus metrics at /metrics (scraped by Prometheus)."""
    data = prometheus_client.generate_latest()
    return Response(
        content=data,
        media_type=prometheus_client.CONTENT_TYPE_LATEST,
    )
