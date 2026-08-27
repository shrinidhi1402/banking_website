"""API v1 router - aggregates all endpoint routers."""

from fastapi import APIRouter

from crq.api.v1 import (
    assets,
    auth,
    compliance,
    events,
    optimize,
    query,
    reports,
    risk,
    scenarios,
    vulnerabilities,
)

router = APIRouter()
router.include_router(events.router, prefix="/events", tags=["ingestion"])
router.include_router(risk.router, prefix="/risk", tags=["risk"])
router.include_router(assets.router, prefix="/assets", tags=["assets"])
router.include_router(vulnerabilities.router, prefix="/vulnerabilities", tags=["vulnerabilities"])
router.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
router.include_router(optimize.router, prefix="/optimize", tags=["optimizer"])
router.include_router(compliance.router, prefix="/compliance", tags=["compliance"])
router.include_router(query.router, prefix="/query", tags=["query"])
router.include_router(reports.router, prefix="/reports", tags=["reports"])
router.include_router(auth.router, prefix="/auth", tags=["auth"])
