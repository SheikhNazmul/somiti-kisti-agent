from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from app.db.session import SessionDep
from app.modules.users import services
from app.modules.users.dependencies import CurrentUser
from app.modules.users.models import User
from app.modules.users.schemas import TokenOut, UserOut, UserRegister

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(data: UserRegister, session: SessionDep) -> User:
    return await services.register_user(session, data)


@auth_router.post("/login", response_model=TokenOut)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep,
) -> TokenOut:
    access_token = await services.login_user(
        session, form.username, form.password
    )
    return TokenOut(access_token=access_token)


@auth_router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> User:
    return current_user
