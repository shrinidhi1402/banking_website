"""
CRQ AI-Knowledge — Configuration.

Reads settings from .env via pydantic-settings.
"""

from __future__ import annotations

import logging
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Root of the ai-knowledge package (…/ai-knowledge/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_DIR = PROJECT_ROOT / "knowledge"


class Settings(BaseSettings):
    """Application settings loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────
    supabase_db_url: str

    # ── API ───────────────────────────────────────────────────
    ai_knowledge_port: int = 8100

    # ── Embedding model ───────────────────────────────────────
    embedding_model: str = "BAAI/bge-m3"
    embedding_dimension: int = 1024

    # ── Retrieval defaults ────────────────────────────────────
    default_top_k: int = 5


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached singleton settings instance."""
    settings = Settings()  # type: ignore[call-arg]
    logger.info("Settings loaded — DB host: %s", _mask_url(settings.supabase_db_url))
    return settings


def _mask_url(url: str) -> str:
    """Mask password in a connection URL for safe logging."""
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(url)
        if parsed.password:
            masked = parsed._replace(
                netloc=f"{parsed.username}:****@{parsed.hostname}:{parsed.port}"
            )
            return urlunparse(masked)
    except Exception:
        pass
    return "****"
