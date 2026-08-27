"""Mock connector - synthetic events for dev/testing. B2.1."""

from __future__ import annotations

from crq.ingestion.connectors.base import BaseConnector


class MockConnector(BaseConnector):
    async def fetch(self) -> list[dict[str, object]]:
        return []
