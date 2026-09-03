"""Application configuration — pydantic-settings based, reads from .env.

All env vars are prefixed with CRQ_ (e.g. CRQ_DATABASE_URL).
Never commit real secrets — use .env.example as the template.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration object.

    Reads from environment variables (CRQ_* prefix) and a .env file.
    Uses lru_cache via get_settings() so the object is a singleton.
    """

    model_config = SettingsConfigDict(
        env_prefix="CRQ_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # App                                                                  #
    # ------------------------------------------------------------------ #
    APP_NAME: str = "CRQ API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" | "console"

    # ------------------------------------------------------------------ #
    # API                                                                  #
    # ------------------------------------------------------------------ #
    API_PREFIX: str = "/api/v1"
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",  # bank site (Vite dev server)
        "http://localhost:5174",  # bank site (Vite fallback port)
    ]

    # ------------------------------------------------------------------ #
    # Database — Supabase                                                  #
    # ------------------------------------------------------------------ #
    SUPABASE_URL: str = "postgresql+asyncpg://postgres.[ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
    SUPABASE_SERVICE_KEY: str = "change-me-in-production"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_PRE_PING: bool = True

    # ------------------------------------------------------------------ #
    # Redis                                                                #
    # ------------------------------------------------------------------ #
    REDIS_URL: str = "redis://localhost:6379/0"

    # ------------------------------------------------------------------ #
    # Supabase Auth                                                        #
    # ------------------------------------------------------------------ #
    # IMPORTANT: Set DISABLE_AUTH=true in dev so teammates are never
    # blocked by auth setup. See auth/supabase_auth.py for details.
    DISABLE_AUTH: bool = True
    SUPABASE_JWT_SECRET: str = "change-me-in-production"

    # ------------------------------------------------------------------ #
    # Observability                                                        #
    # ------------------------------------------------------------------ #
    OTEL_ENABLED: bool = True
    OTEL_EXPORTER_OTLP_ENDPOINT: str = "http://localhost:4317"
    OTEL_SERVICE_NAME: str = "crq-api"
    GLITCHTIP_DSN: str = ""  # Set in prod — e.g. http://key@glitchtip:8000/1

    # ------------------------------------------------------------------ #
    # Celery                                                               #
    # ------------------------------------------------------------------ #
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ------------------------------------------------------------------ #
    # AI Gateway (B4)                                                      #
    # ------------------------------------------------------------------ #
    # Primary: local Ollama (OpenAI-compatible at /v1)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:latest"

    # Fallback: Groq cloud API (OpenAI-compatible)
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama3-8b-8192"

    # Legacy vLLM fields kept for backward compat (unused by new client)
    VLLM_BASE_URL: str = "http://localhost:8000/v1"
    TEI_BASE_URL: str = "http://localhost:8001"
    LLM_MODEL: str = "meta-llama/Llama-3.1-8B-Instruct"
    EMBEDDING_MODEL: str = "BAAI/bge-m3"



    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, v: str) -> str:
        """Ensure LOG_LEVEL is a valid Python logging level."""
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        upper = v.upper()
        if upper not in allowed:
            msg = f"LOG_LEVEL must be one of {allowed}"
            raise ValueError(msg)
        return upper


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (cached after first call)."""
    return Settings()
