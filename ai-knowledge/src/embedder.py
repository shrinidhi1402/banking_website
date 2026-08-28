"""
CRQ AI-Knowledge — Embedding wrapper.

Loads BAAI/bge-m3 (or configured model) via sentence-transformers
and provides a simple batch-embedding interface.
"""

from __future__ import annotations

import logging
from typing import Sequence

from sentence_transformers import SentenceTransformer

from src.config import get_settings

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    """Return the cached sentence-transformer model (singleton)."""
    global _model
    if _model is None:
        settings = get_settings()
        logger.info("Loading embedding model: %s …", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info(
            "Model loaded — dimension=%d",
            _model.get_sentence_embedding_dimension(),
        )
    return _model


def embed_texts(texts: Sequence[str], batch_size: int = 32) -> list[list[float]]:
    """
    Embed a batch of texts and return a list of float vectors.

    Parameters
    ----------
    texts : sequence of str
        The texts to embed.
    batch_size : int
        Encoding batch size (tune for available memory).

    Returns
    -------
    list[list[float]]
        One embedding vector per input text.
    """
    model = get_model()
    embeddings = model.encode(
        list(texts),
        batch_size=batch_size,
        show_progress_bar=len(texts) > 10,
        normalize_embeddings=True,  # unit-norm for cosine similarity
    )
    return [vec.tolist() for vec in embeddings]


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]


def is_model_loaded() -> bool:
    """Check whether the model has been loaded into memory."""
    return _model is not None
