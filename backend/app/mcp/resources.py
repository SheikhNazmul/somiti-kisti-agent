"""The MCP resource: data a client can read directly at a URI."""

from app.mcp.dependencies import get_mcp_session
from app.modules.areas import services as area_services


async def areas_list() -> str:
    """The somiti's collection areas: id, name and collection day."""
    async with get_mcp_session() as session:
        areas = await area_services.list_areas(session)
    lines = [
        f"{area.id}. {area.name} - collection day: {area.collection_day.value}"
        for area in areas
    ]
    return "\n".join(lines)
