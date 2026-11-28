"""Rebuild the knowledge base (RAG) from the rule documents.

Run from the project root, the same way as scripts/seed.py:

    uv run python -m scripts.ingest_knowledge

Safe to run again: chunks are matched by (source, chunk_index), so a
second run updates the rows instead of duplicating them.
"""

import asyncio

from app.db.session import SessionLocal
from app.modules.knowledge import services


async def main() -> None:
    async with SessionLocal() as session:
        result = await services.ingest_knowledge(session)
    print(f"Ingested {result['chunks']} chunks from '{result['source']}'.")


if __name__ == "__main__":
    asyncio.run(main())
