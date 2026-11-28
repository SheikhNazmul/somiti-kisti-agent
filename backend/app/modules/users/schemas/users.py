import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.users.models import UserRole


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=3, max_length=120)


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
