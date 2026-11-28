import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.mcp.server import mcp as mcp_server
from app.mcp.server import mcp_http_app

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The MCP server mounted at /mcp needs its session manager running
    # for as long as the API is up.
    async with mcp_server.session_manager.run():
        yield


app = FastAPI(title=get_settings().APP_NAME, lifespan=lifespan)


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


app.include_router(api_router)

# The MCP server lives outside /api/v1: MCP clients connect to /mcp.
app.mount("/mcp", mcp_http_app)
