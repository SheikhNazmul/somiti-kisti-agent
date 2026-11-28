from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.llm import client
from app.modules.chat import tools
from app.modules.chat.prompts import SYSTEM_PROMPT
from app.modules.chat.schemas import ChatRequest, ChatResponse


async def get_reply(session: AsyncSession, data: ChatRequest) -> ChatResponse:
    async def run_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
        return await tools.execute_tool(session, name, args)

    reply = await client.generate_reply(
        SYSTEM_PROMPT,
        data.messages,
        tool_declarations=tools.TOOL_DECLARATIONS,
        tool_runner=run_tool,
    )
    return ChatResponse(reply=reply)
