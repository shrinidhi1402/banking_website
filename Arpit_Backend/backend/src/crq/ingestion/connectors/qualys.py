"""Qualys connector stub - parses Qualys CSV. B2.1."""

from __future__ import annotations

from crq.ingestion.connectors.base import BaseConnector


class QualysConnector(BaseConnector):
    async def fetch(self) -> list[dict[str, object]]:
        raise NotImplementedError("Implemented in Phase B2.1")
