import logging

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.session import SessionDep
from app.modules.areas.controllers import areas_router
from app.modules.chat.controllers import chat_router
from app.modules.gata.controllers import gata_router
from app.modules.knowledge.controllers import knowledge_router
from app.modules.installments.controllers import installments_router
from app.modules.loans.controllers import loans_router
from app.modules.members.controllers import members_router
from app.modules.users.controllers import auth_router

logger = logging.getLogger(__name__)

app = FastAPI(title=get_settings().APP_NAME)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    headers = (
        {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.code, "message": exc.message},
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    codes = {
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": codes.get(exc.status_code, "http_error"),
            "message": str(exc.detail),
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Invalid request data",
            "details": details,
        },
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(
    request: Request, exc: IntegrityError
) -> JSONResponse:
    logger.warning("Database integrity error: %s", exc.orig)
    return JSONResponse(
        status_code=409,
        content={
            "error": "conflict",
            "message": "The operation conflicts with existing data",
        },
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    logger.exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "Something went wrong"},
    )


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
api_router.include_router(areas_router)
api_router.include_router(members_router)
api_router.include_router(loans_router)
api_router.include_router(installments_router)
api_router.include_router(gata_router)
api_router.include_router(chat_router)
api_router.include_router(knowledge_router)

app.include_router(api_router)
