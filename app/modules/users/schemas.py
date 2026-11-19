import uuid

from pydantic import BaseModel, ConfigDict

from app.modules.users.models import UserRole


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
