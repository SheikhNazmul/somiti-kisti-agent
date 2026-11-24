"""Create the pgvector extension and the app schema if they are missing.

Runs before the migrations on every deploy. Both statements use
IF NOT EXISTS, so running it again changes nothing.
"""

import asyncio

from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import engine


async def main() -> None:
    schema = get_settings().DB_SCHEMA
    async with engine.begin() as conn:
        await conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await engine.dispose()
    print(f"bootstrap: extension 'vector' and schema '{schema}' are ready")


if __name__ == "__main__":
    asyncio.run(main())
