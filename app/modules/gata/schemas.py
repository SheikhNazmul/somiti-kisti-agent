from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.gata.models import GataFrequency, GataGroupStatus


class GataGroupCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    amount: Decimal = Field(gt=0)
    frequency: GataFrequency = GataFrequency.weekly
    total_slots: int = Field(gt=0)
    start_date: date


class GataGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: Decimal
    frequency: GataFrequency
    total_slots: int
    start_date: date
    status: GataGroupStatus


class GataMemberAdd(BaseModel):
    member_id: int


class GataMemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    member_id: int
    position: int
    has_won: bool
    won_round: int | None


class GataPaymentCreate(BaseModel):
    member_id: int
    round_number: int = Field(ge=1)
    amount: Decimal = Field(gt=0)


class GataPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    member_id: int
    round_number: int
    amount: Decimal
    paid_on: date
    collected_by: UUID | None


class GataPayoutOut(BaseModel):
    group_id: int
    round_number: int
    winner_member_id: int
    winner_name: str
    payout_amount: Decimal
    group_status: GataGroupStatus


class GataStatusOut(BaseModel):
    group_id: int
    status: GataGroupStatus
    current_round: int
    total_rounds: int
    winners_count: int
    paid_member_ids: list[int]
    unpaid_member_ids: list[int]
    unpaid_member_names: list[str]
    not_won_member_ids: list[int]
