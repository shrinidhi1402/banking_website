"""Abstract connector base class."""

from __future__ import annotations

from abc import ABC, abstractmethod


class BaseConnector(ABC):
    """Every connector must implement fetch()."""

    @abstractmethod
    async def fetch(self) -> list[dict[str, object]]: ...
