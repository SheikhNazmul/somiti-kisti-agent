from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.integrations.embeddings import client as embeddings
from app.modules.knowledge import documents, repositories


async def ingest_knowledge(session: AsyncSession) -> dict:
    """(Re)build the knowledge base from the rule documents.

    Every section is embedded and stored. Safe to run again: the rows
    are matched by (source, chunk_index), so nothing is duplicated.
    """
    vectors = await embeddings.embed_texts(list(documents.SECTIONS))
    count = await repositories.upsert_chunks(
        session, documents.SOURCE, list(documents.SECTIONS), vectors
    )
    await session.commit()
    return {"source": documents.SOURCE, "chunks": count}


async def search_knowledge(session: AsyncSession, query: str) -> dict:
    """Find the rule sections closest in meaning to a question."""
    settings = get_settings()
    vector = await embeddings.embed_text(query)
    rows = await repositories.search_chunks(
        session,
        vector,
        top_k=settings.RAG_TOP_K,
        max_distance=settings.RAG_MAX_DISTANCE,
    )
    return {
        "results": [
            {
                "source": chunk.source,
                "content": chunk.content,
                "distance": round(distance, 4),
            }
            for chunk, distance in rows
        ]
    }
