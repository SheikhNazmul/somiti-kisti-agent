from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.members.models import AccountType


class MemberCreate(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    nid_last4: str = Field(min_length=4, max_length=4)
    area_id: int
    account_type: AccountType
    joined_on: date


class MemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    phone: str | None = Field(default=None, min_length=6, max_length=20)
    nid_last4: str | None = Field(default=None, min_length=4, max_length=4)
    area_id: int | None = None
    joined_on: date | None = None
    is_active: bool | None = None


class AccountTypeUpdate(BaseModel):
    account_type: AccountType


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    phone: str
    nid_last4: str
    area_id: int
    account_type: AccountType
    joined_on: date
    is_active: bool


class MemberBalanceOut(BaseModel):
    member_id: int
    loan_total: Decimal
    total_paid: Decimal
    remaining: Decimal
