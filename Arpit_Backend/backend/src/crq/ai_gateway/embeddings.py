"""Text Embeddings Inference (TEI) client."""

import httpx

from crq.core.config import get_settings
from crq.core.logging import get_logger

log = get_logger(__name__)

class EmbeddingsClient:
    """Async client for local TEI server."""
    
    def __init__(self):
        self.settings = get_settings()
        self.base_url = self.settings.TEI_BASE_URL.rstrip('/')
        
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        if not texts:
            return []
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.base_url}/embed"
            try:
                response = await client.post(url, json={"inputs": texts})
                response.raise_for_status()
                # TEI returns a list of embeddings directly
                data = response.json()
                if isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                     return data
                elif isinstance(data, list):
                     # fallback for single vector return
                     return [data]
                raise ValueError("Unexpected response format from TEI")
            except httpx.HTTPError as e:
                log.error("tei_api_error", error=str(e), url=url)
                raise
                
embeddings_client = EmbeddingsClient()
