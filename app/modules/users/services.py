from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.modules.users import repositories
from app.modules.users.models import User, UserRole
from app.modules.users.schemas import UserRegister

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"


async def register_user(session: AsyncSession, data: UserRegister) -> User:
    email = str(data.email).lower()
    existing = await repositories.get_user_by_email(session, email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.collector,
    )
    return await repositories.create_user(session, user)


async def login_user(session: AsyncSession, email: str, password: str) -> str:
    user = await repositories.get_user_by_email(session, email.lower())
    if (
        user is None
        or not user.is_active
        or not verify_password(password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=INVALID_CREDENTIALS_MESSAGE,
        )
    return create_access_token(user.id)
