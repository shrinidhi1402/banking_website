"""Structured JSON logging setup using structlog.

Every log line is JSON-formatted and includes:
- timestamp (ISO 8601)
- level
- logger (module name)
- correlation_id  (injected by CorrelationIDMiddleware into contextvars)
- event (the log message)
- any extra kwargs passed to the logger

Usage:
    from crq.core.logging import get_logger
    log = get_logger(__name__)
    log.info("thing happened", asset_id=str(asset_id), eal=42.0)
"""

from __future__ import annotations

import logging
import sys
from typing import TYPE_CHECKING, cast

import structlog

if TYPE_CHECKING:
    from crq.core.config import Settings


def configure_logging(settings: Settings) -> None:
    """Configure structlog + stdlib logging.  Call once at app startup."""
    log_level = getattr(logging, settings.LOG_LEVEL, logging.INFO)

    # Shared processors for both structlog and stdlib
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.LOG_FORMAT == "console":
        # Human-readable output for local development
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        # JSON output for production / log aggregation (Loki)
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)

    # Quiet noisy libraries
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "aiokafka"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a structlog bound logger for the given module name."""
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))
