"""LLM client with Ollama (primary) → Groq (fallback) strategy."""

from typing import Any
import httpx
from pydantic import BaseModel
import json

from crq.core.config import get_settings
from crq.core.logging import get_logger

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Base transport
# ---------------------------------------------------------------------------

class _BaseClient:
    """Shared OpenAI-compatible chat completion logic."""

    # Subclasses set this to False if the provider rejects response_format:json_object
    supports_json_mode: bool = True

    def __init__(self, base_url: str, model: str, headers: dict | None = None):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._headers = {"Content-Type": "application/json", **(headers or {})}
        # Subclasses override this with the correct full URL for chat completions
        self._chat_url: str = f"{self.base_url}/v1/chat/completions"

    async def _post(self, url: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=self._headers)
            response.raise_for_status()
            return response.json()

    async def complete(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        temperature: float = 0.1,
        json_mode: bool = False,
    ) -> str:
        """Standard chat completion — returns the assistant message content."""
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        # Only send response_format if this provider supports it
        if json_mode and self.supports_json_mode:
            payload["response_format"] = {"type": "json_object"}

        result = await self._post(self._chat_url, payload)
        return result["choices"][0]["message"]["content"]

    async def complete_structured(
        self,
        messages: list[dict[str, str]],
        response_model: type[BaseModel],
        temperature: float = 0.0,
    ) -> BaseModel:
        """Structured completion: injects a concrete field example and parses JSON robustly."""
        # Build a field-level example so small models understand what to fill in,
        # not just echo back the schema object.
        fields = response_model.model_fields
        field_lines = []
        for fname, finfo in fields.items():
            desc = finfo.description or ""
            field_lines.append(f'  "{fname}": <{fname}: {desc}>')
        example_hint = "{\n" + ",\n".join(field_lines) + "\n}"

        schema_instruction = (
            f"OUTPUT ONLY a JSON object with exactly these fields — no extra text, no markdown:\n"
            f"{example_hint}\n\n"
            f"Full schema for reference:\n{json.dumps(response_model.model_json_schema())}"
        )

        new_messages: list[dict[str, str]] = []
        has_system = False
        for msg in messages:
            if msg["role"] == "system":
                new_messages.append(
                    {"role": "system", "content": f"{msg['content']}\n\n{schema_instruction}"}
                )
                has_system = True
            else:
                new_messages.append(msg)

        if not has_system:
            new_messages.insert(0, {"role": "system", "content": schema_instruction})

        raw = await self.complete(new_messages, temperature=temperature, json_mode=True)

        # Strip markdown code fences if the model wrapped the JSON
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = "\n".join(
                line for line in cleaned.splitlines()
                if not line.strip().startswith("```")
            ).strip()

        try:
            return response_model.model_validate(json.loads(cleaned))
        except (json.JSONDecodeError, Exception) as e:
            log.error("llm_json_parse_error", raw=raw, cleaned=cleaned, error=str(e))
            raise ValueError(f"LLM did not return valid JSON: {e}")


# ---------------------------------------------------------------------------
# Concrete clients
# ---------------------------------------------------------------------------

class OllamaClient(_BaseClient):
    """Calls local Ollama server — no auth required."""

    def __init__(self):
        s = get_settings()
        super().__init__(base_url=s.OLLAMA_BASE_URL, model=s.OLLAMA_MODEL)
        log.info("ollama_client_init", base_url=s.OLLAMA_BASE_URL, model=s.OLLAMA_MODEL)


class GroqClient(_BaseClient):
    """Calls Groq cloud API — requires Bearer token. Fixes pre-existing missing-auth bug."""

    # llama3-8b-8192 on Groq rejects response_format:json_object — use prompt-only JSON
    supports_json_mode: bool = False

    def __init__(self):
        s = get_settings()
        if not s.GROQ_API_KEY:
            log.warning("groq_api_key_missing", hint="Set CRQ_GROQ_API_KEY in .env")
        super().__init__(
            base_url=s.GROQ_BASE_URL,
            model=s.GROQ_MODEL,
            headers={"Authorization": f"Bearer {s.GROQ_API_KEY}"},
        )
        # GROQ_BASE_URL already ends in /v1, so only append /chat/completions
        self._chat_url = f"{self.base_url}/chat/completions"
        log.info("groq_client_init", base_url=s.GROQ_BASE_URL, model=s.GROQ_MODEL)


# ---------------------------------------------------------------------------
# Fallback wrapper — Ollama first, Groq on any transport/HTTP error
# ---------------------------------------------------------------------------

_FALLBACK_ERRORS = (
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.RemoteProtocolError,
    httpx.HTTPStatusError,
)


class FallbackLLMClient:
    """
    Primary: Ollama (local, fast, free).
    Fallback: Groq (cloud, requires CRQ_GROQ_API_KEY).

    Any connection, timeout, or HTTP error on Ollama triggers the fallback.
    Both expose the same complete() / complete_structured() interface.
    """

    def __init__(self):
        self._ollama = OllamaClient()
        self._groq = GroqClient()

    async def complete(self, messages: list[dict[str, str]], **kwargs) -> str:
        try:
            result = await self._ollama.complete(messages, **kwargs)
            log.info("llm_response_source", source="ollama")
            return result
        except _FALLBACK_ERRORS as e:
            log.warning("ollama_fallback_triggered", error=str(e), fallback="groq")
            result = await self._groq.complete(messages, **kwargs)
            log.info("llm_response_source", source="groq")
            return result

    async def complete_structured(
        self,
        messages: list[dict[str, str]],
        response_model: type[BaseModel],
        **kwargs,
    ) -> BaseModel:
        try:
            result = await self._ollama.complete_structured(messages, response_model, **kwargs)
            log.info("llm_structured_response_source", source="ollama")
            return result
        except _FALLBACK_ERRORS as e:
            log.warning("ollama_structured_fallback_triggered", error=str(e), fallback="groq")
            result = await self._groq.complete_structured(messages, response_model, **kwargs)
            log.info("llm_structured_response_source", source="groq")
            return result


# Singleton used throughout the app (drop-in replacement for old llm_client)
llm_client = FallbackLLMClient()
