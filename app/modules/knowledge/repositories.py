from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge.models import KnowledgeChunk


async def upsert_chunks(
    session: AsyncSession,
    source: str,
    contents: list[str],
    vectors: list[list[float]],
) -> int:
    """Store chunks for one source, replacing what was there before.

    Rows are matched by (source, chunk_index), so running the ingest
    twice updates the same rows instead of duplicating them. Chunks left
    over from a longer older version of the document are removed.
    """
    existing = {
        chunk.chunk_index: chunk
        for chunk in await session.scalars(
            select(KnowledgeChunk).where(KnowledgeChunk.source == source)
        )
    }
    for index, (content, vector) in enumerate(zip(contents, vectors)):
        chunk = existing.get(index)
        if chunk is None:
            session.add(
                KnowledgeChunk(
                    source=source,
                    chunk_index=index,
                    content=content,
                    embedding=vector,
                )
            )
        else:
            chunk.content = content
            chunk.embedding = vector
    await session.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.source == source,
            KnowledgeChunk.chunk_index >= len(contents),
        )
    )
    return len(contents)


async def search_chunks(
    session: AsyncSession,
    vector: list[float],
    top_k: int,
    max_distance: float,
) -> list[tuple[KnowledgeChunk, float]]:
    """Find the chunks closest to a question vector (cosine distance).

    A smaller distance means a closer meaning. Chunks farther away than
    max_distance are left out, so an unrelated question finds nothing
    instead of a random rule.
    """
    distance = KnowledgeChunk.embedding.cosine_distance(vector)
    rows = await session.execute(
        select(KnowledgeChunk, distance.label("distance"))
        .where(distance <= max_distance)
        .order_by(distance)
        .limit(top_k)
    )
    return [(chunk, float(dist)) for chunk, dist in rows.all()]
