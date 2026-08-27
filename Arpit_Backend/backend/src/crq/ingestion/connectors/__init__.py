"""Abstract connector base class - implemented in B2.1."""

from __future__ import annotations

from abc import ABC, abstractmethod


class BaseConnector(ABC):
    """Every connector (Qualys, Tenable, Splunk, Mock) must implement this."""

    @abstractmethod
    async def fetch(self) -> list[dict[str, object]]: ...
