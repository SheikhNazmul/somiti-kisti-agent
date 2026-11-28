from fastapi import APIRouter

from app.db.session import SessionDep
from app.modules.knowledge import services
from app.modules.knowledge.schemas import (
    IngestResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.modules.users.dependencies import AdminUser, CurrentUser

knowledge_router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@knowledge_router.post("/ingest", response_model=IngestResponse)
async def ingest(session: SessionDep, admin: AdminUser) -> IngestResponse:
    """Rebuild the knowledge base from the rule documents (admin only)."""
    result = await services.ingest_knowledge(session)
    return IngestResponse(**result)


@knowledge_router.post("/search", response_model=KnowledgeSearchResponse)
async def search(
    data: KnowledgeSearchRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> KnowledgeSearchResponse:
    """Find the rule sections closest to a question (used by the chat)."""
    result = await services.search_knowledge(session, data.query)
    return KnowledgeSearchResponse(**result)
