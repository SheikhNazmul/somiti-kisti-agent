from fastapi import APIRouter, Depends, FastAPI
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.db.session import SessionDep
from app.modules.users.controllers import auth_router

app = FastAPI(title=get_settings().APP_NAME)

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    return {"status": "ok", "app": settings.APP_NAME}


@api_router.get("/health/db")
async def health_db(session: SessionDep) -> dict[str, str]:
    result = await session.execute(text("SELECT version();"))
    version = result.scalar_one()

    ext = await session.execute(
        text("SELECT extname FROM pg_extension WHERE extname = 'vector';")
    )
    has_vector = ext.scalar_one_or_none() is not None

    return {
        "database": "connected",
        "version": version,
        "has_vector": "yes" if has_vector else "no",
    }


api_router.include_router(auth_router)

app.include_router(api_router)
