"""MCP server: the somiti's tools over the Model Context Protocol.

The same six read-only tools the chat assistant uses are published here
in the standard MCP format, so any MCP client (for example Cursor or
Claude Desktop) can call them too. Nothing is re-implemented: every MCP
tool forwards to app.modules.chat.tools.execute_tool, so the answers
are identical to the chat's.

Two ways to run it:
- Inside the API: main.py mounts it at /mcp (streamable HTTP). A valid
  login token is required, exactly like the REST endpoints.
- On its own, for a local MCP client over stdio:
      uv run python -m app.mcp_server
"""

import uuid
from typing import Any

from mcp.server.fastmcp import FastMCP
from starlette.responses import JSONResponse

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.modules.chat import tools
from app.modules.users import repositories as user_repositories

mcp = FastMCP(
    "somiti-kisti-agent",
    instructions=(
        "Read-only tools for the Somiti Kisti Agent, a Bangladeshi somiti "
        "(weekly loan installments and rotating group savings called gata). "
        "The tools only read information; they never move money."
    ),
    stateless_http=True,
    json_response=True,
    streamable_http_path="/",
)


async def _run(name: str, args: dict[str, Any]) -> dict:
    async with SessionLocal() as session:
        return await tools.execute_tool(session, name, args)


@mcp.tool()
async def find_member(search: str) -> dict:
    """Find somiti members by name or phone number.

    Use this first when a question mentions a member by name, to get the
    member id that the other tools need.
    """
    return await _run("find_member", {"search": search})


@mcp.tool()
async def get_member_balance(member_id: int) -> dict:
    """Get one member's loan totals: total payable, total paid, remaining.

    Needs the member id from find_member.
    """
    return await _run("get_member_balance", {"member_id": member_id})


@mcp.tool()
async def list_due_installments(area_id: int | None = None) -> dict:
    """List installments that are due and not fully paid.

    Optionally limit the list to one area. Returns the total count and
    the first few items.
    """
    args: dict[str, Any] = {}
    if area_id is not None:
        args["area_id"] = area_id
    return await _run("list_due_installments", args)


@mcp.tool()
async def list_gata_groups() -> dict:
    """List all gata (rotating group savings) groups with their status."""
    return await _run("list_gata_groups", {})


@mcp.tool()
async def get_gata_status(group_id: int) -> dict:
    """Get one gata group's status.

    The current round, how many winners so far, and which members have
    not paid in the current round.
    """
    return await _run("get_gata_status", {"group_id": group_id})


@mcp.tool()
async def search_knowledge(query: str) -> dict:
    """Search the somiti's rule book.

    Use this for questions about rules and procedures: loan and
    installment rules, gata rules, membership rules. Returns the closest
    rule passages.
    """
    return await _run("search_knowledge", {"query": query})


class McpAuthMiddleware:
    """Require a valid login token on every MCP request.

    The MCP endpoint can read member information, so it follows the same
    rule as the REST API: no token, no access.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = {key.lower(): value for key, value in scope.get("headers", [])}
            raw = headers.get(b"authorization", b"").decode("latin-1")
            token = raw[7:].strip() if raw.lower().startswith("bearer ") else ""
            if not await self._token_is_valid(token):
                response = JSONResponse(
                    {
                        "error": "unauthorized",
                        "message": "A valid login token is required.",
                    },
                    status_code=401,
                    headers={"WWW-Authenticate": "Bearer"},
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)

    @staticmethod
    async def _token_is_valid(token: str) -> bool:
        if not token:
            return False
        payload = decode_access_token(token)
        if payload is None:
            return False
        try:
            user_id = uuid.UUID(payload.get("sub"))
        except (ValueError, TypeError, AttributeError):
            return False
        async with SessionLocal() as session:
            user = await user_repositories.get_user_by_id(session, user_id)
        return user is not None and user.is_active


# The HTTP version of the server, with the login check wrapped around it.
# main.py mounts this at /mcp.
mcp_http_app = McpAuthMiddleware(mcp.streamable_http_app())


if __name__ == "__main__":
    mcp.run()
