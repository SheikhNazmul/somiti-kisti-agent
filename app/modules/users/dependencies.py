import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.db.session import SessionDep
from app.modules.users import repositories
from app.modules.users.models import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    session: SessionDep,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_error = UnauthorizedError("Could not validate credentials")
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error
    try:
        user_id = uuid.UUID(payload.get("sub"))
    except (ValueError, TypeError, AttributeError):
        raise credentials_error from None
    user = await repositories.get_user_by_id(session, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def require_admin(current_user: CurrentUser) -> User:
    if current_user.role != UserRole.admin:
        raise ForbiddenError("Admin access required")
    return current_user


AdminUser = Annotated[User, Depends(require_admin)]
