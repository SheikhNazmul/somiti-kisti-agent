from fastapi import APIRouter

from app.db.session import SessionDep
from app.modules.chat import services
from app.modules.chat.schemas import ChatRequest, ChatResponse
from app.modules.users.dependencies import CurrentUser

chat_router = APIRouter(prefix="/chat", tags=["chat"])


@chat_router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest, session: SessionDep, current_user: CurrentUser
) -> ChatResponse:
    return await services.get_reply(session, data)
