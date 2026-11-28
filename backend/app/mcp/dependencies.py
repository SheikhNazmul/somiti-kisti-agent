"""Shared helpers for the MCP package.

The session maker and the login-token check live here so server.py
and tools.py do not repeat them.
"""

import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.modules.chat import tools
from app.modules.users import repositories as user_repositories


@asynccontextmanager
async def get_mcp_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def run_tool(name: str, args: dict[str, Any]) -> dict:
    """Run one chat tool by name, the same way the chat endpoint does."""
    async with get_mcp_session() as session:
        return await tools.execute_tool(session, name, args)


async def token_is_valid(token: str) -> bool:
    """A token counts only if it decodes and its user still exists
    and is active — the same rule as the REST API."""
    if not token:
        return False
    payload = decode_access_token(token)
    if payload is None:
        return False
    try:
        user_id = uuid.UUID(payload.get("sub"))
    except (ValueError, TypeError, AttributeError):
        return False
    async with get_mcp_session() as session:
        user = await user_repositories.get_user_by_id(session, user_id)
    return user is not None and user.is_active
