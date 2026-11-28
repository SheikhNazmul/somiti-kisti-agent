"""MCP server: the somiti's tools over the Model Context Protocol.

The package is split by kind, and this file only wires it together:
- tools.py holds the same seven read-only tools the chat assistant
  uses; every one forwards to app.modules.chat.tools.execute_tool, so
  the answers are identical to the chat's.
- resources.py holds one resource (the list of collection areas).
- prompts.py holds one ready-made prompt (a weekly collection
  report).
- dependencies.py holds the shared session maker and token check.

Two ways to run it:
- Inside the API: main.py mounts it at /mcp (streamable HTTP). A valid
  login token is required, exactly like the REST endpoints.
- On its own, for a local MCP client over stdio:
      uv run python -m app.mcp.server
"""

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.responses import JSONResponse

from app.mcp import dependencies
from app.mcp.prompts import weekly_collection_report
from app.mcp.resources import areas_list
from app.mcp.tools import (
    find_member,
    get_collection_summary,
    get_gata_status,
    get_member_balance,
    list_due_installments,
    list_gata_groups,
    search_knowledge,
)

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
    # DNS rebinding protection stays on: only this service's own public
    # host and local addresses may call the MCP endpoint.
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "somiti-kisti-agent.onrender.com",
            "127.0.0.1:*",
            "localhost:*",
            "[::1]:*",
        ],
        allowed_origins=[
            "https://somiti-kisti-agent.onrender.com",
            "http://127.0.0.1:*",
            "http://localhost:*",
        ],
    ),
)

mcp.tool()(find_member)
mcp.tool()(get_member_balance)
mcp.tool()(list_due_installments)
mcp.tool()(list_gata_groups)
mcp.tool()(get_gata_status)
mcp.tool()(search_knowledge)
mcp.tool()(get_collection_summary)
mcp.resource("somiti://areas/list")(areas_list)
mcp.prompt()(weekly_collection_report)


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
            if not await dependencies.token_is_valid(token):
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


# The HTTP version of the server, with the login check wrapped around it.
# main.py mounts this at /mcp.
mcp_http_app = McpAuthMiddleware(mcp.streamable_http_app())


if __name__ == "__main__":
    mcp.run()
