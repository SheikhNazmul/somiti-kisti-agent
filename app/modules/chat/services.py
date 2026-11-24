from app.integrations.llm import client
from app.modules.chat.prompts import SYSTEM_PROMPT
from app.modules.chat.schemas import ChatRequest, ChatResponse


async def get_reply(data: ChatRequest) -> ChatResponse:
    reply = await client.generate_reply(SYSTEM_PROMPT, data.messages)
    return ChatResponse(reply=reply)
