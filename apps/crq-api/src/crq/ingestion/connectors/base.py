"""Abstract connector base class for security telemetry ingestion."""

from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from typing import Any

from crq.schemas.events import EventEnvelope


class BaseConnector(ABC):
    """Abstract interface that all security tool connectors must implement."""

    name: str = "base"

    @abstractmethod
    async def fetch(self) -> list[dict[str, Any]]:
        """Fetch raw findings/events from external tool API or poller."""
        ...

    @abstractmethod
    def parse(self, raw_data: Any, org_id: uuid.UUID) -> list[EventEnvelope]:
        """Convert raw scanner/tool findings into standardized EventEnvelopes."""
        ...
