"""vLLM OpenAI-compatible client for CRQ AI Gateway."""

from typing import Any
import httpx
from pydantic import BaseModel
import json

from crq.core.config import get_settings
from crq.core.logging import get_logger

log = get_logger(__name__)

class LLMClient:
    """Async client for local vLLM serving OpenAI-compatible API."""
    
    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.VLLM_BASE_URL.rstrip('/')
        self.model = self.settings.LLM_MODEL
        
    async def _post(self, endpoint: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=45.0) as client:
            url = f"{self.base_url}/v1/{endpoint}"
            try:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPError as e:
                log.error("llm_api_error", error=str(e), url=url)
                raise
                
    async def complete(
        self, 
        messages: list[dict[str, str]], 
        max_tokens: int = 1024, 
        temperature: float = 0.1,
        json_mode: bool = False
    ) -> str:
        """Standard chat completion."""
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
            
        result = await self._post("chat/completions", payload)
        return result["choices"][0]["message"]["content"]
        
    async def complete_structured(
        self, 
        messages: list[dict[str, str]], 
        response_model: type[BaseModel],
        temperature: float = 0.0
    ) -> BaseModel:
        """Structured chat completion using JSON mode and Pydantic validation."""
        # Note: In production vLLM, we'd use guided_json (Outlines/XF) if available.
        # For MVP, we instruct the model and use json_mode.
        schema_json = json.dumps(response_model.model_json_schema())
        
        system_msg = (
            f"You are a strict data extraction system. You must output VALID JSON matching "
            f"the following schema:\n{schema_json}"
        )
        
        # Inject schema instructions into system prompt
        new_messages = []
        has_system = False
        for msg in messages:
            if msg["role"] == "system":
                new_messages.append({"role": "system", "content": f"{msg['content']}\n\n{system_msg}"})
                has_system = True
            else:
                new_messages.append(msg)
                
        if not has_system:
            new_messages.insert(0, {"role": "system", "content": system_msg})
            
        raw_content = await self.complete(new_messages, temperature=temperature, json_mode=True)
        
        try:
            parsed = json.loads(raw_content)
            return response_model.model_validate(parsed)
        except json.JSONDecodeError as e:
            log.error("llm_json_parse_error", content=raw_content)
            raise ValueError(f"LLM did not return valid JSON: {e}")
            
llm_client = LLMClient()
