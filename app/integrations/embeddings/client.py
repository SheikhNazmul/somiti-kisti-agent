"""Turn text into embedding vectors with Gemini.

This is the only place that calls the embedding model, the same way
app/integrations/llm/client.py is the only place that calls the chat
model. The vectors are stored in PostgreSQL through pgvector and are
used for the knowledge search (RAG).
"""

import asyncio

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.core.config import get_settings
from app.core.errors import AppError


class EmbeddingError(AppError):
    status_code = 502
    code = "embedding_error"
    default_message = "The embedding service could not answer right now. Please try again."


def _make_client() -> genai.Client:
    settings = get_settings()
    key_value = settings.LLM_API_KEY_VALUE
    return genai.Client(**{"api_key": key_value})


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts; one vector per text, in the same order."""
    if not texts:
        return []
    settings = get_settings()
    client = _make_client()
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            result = await client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=texts,
                config=types.EmbedContentConfig(
                    output_dimensionality=settings.EMBEDDING_DIM
                ),
            )
            return [list(item.values) for item in result.embeddings]
        except genai_errors.ServerError as error:
            # A busy model usually answers on a retry a moment later.
            last_error = error
            if attempt < 2:
                await asyncio.sleep(2 * (attempt + 1))
        except genai_errors.APIError as error:
            raise EmbeddingError() from error
    raise EmbeddingError() from last_error


async def embed_text(text: str) -> list[float]:
    """Embed one text (used for a search question)."""
    vectors = await embed_texts([text])
    return vectors[0]
