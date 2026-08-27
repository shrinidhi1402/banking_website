"""CRQ FastAPI application entry point.

B0.1 — Skeleton with /health stub (upgraded to real checks in B0.2.6).
B0.4 — OpenTelemetry + correlation ID middleware wired in.
"""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from crq.core.config import get_settings
from crq.core.logging import configure_logging
from crq.core.middleware import CorrelationIDMiddleware
from crq.core.telemetry import configure_telemetry


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: startup → yield → shutdown."""
    settings = get_settings()
    configure_logging(settings)
    configure_telemetry(settings)
    yield
    # Cleanup hooks go here (close DB pools, etc.)


def create_app() -> FastAPI:
    """Factory function — returns configured FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="CRQ — CyberRisk Quantifier API",
        description=(
            "AI-powered cyber risk quantification platform for banks. "
            "Converts security telemetry to monetary risk (EAL) via FAIR + Monte Carlo."
        ),
        version="0.1.0",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ------------------------------------------------------------------ #
    # Middleware (order matters — outermost added last)                    #
    # ------------------------------------------------------------------ #
    app.add_middleware(CorrelationIDMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------ #
    # Routers                                                              #
    # ------------------------------------------------------------------ #
    from crq.api.v1 import router as v1_router  # noqa: PLC0415

    app.include_router(v1_router, prefix="/api/v1")

    # Prometheus metrics endpoint (B0.4)
    from crq.core.telemetry import metrics_endpoint  # noqa: PLC0415

    app.add_route("/metrics", metrics_endpoint)

    return app


app = create_app()


# ------------------------------------------------------------------ #
# Root health check (simple liveness probe — no deps required)       #
# ------------------------------------------------------------------ #
@app.get("/health", tags=["ops"], summary="Health check")
async def health() -> JSONResponse:
    """
    Liveness + readiness probe.

    Returns per-dependency status.  Full checks (Postgres, Redis, MinIO)
    are wired in B0.2.6.  Until then returns a simple ok.
    """
    from crq.core.health import check_health  # noqa: PLC0415

    result = await check_health()
    status_code = 200 if result["healthy"] else 503
    return JSONResponse(content=result, status_code=status_code)
