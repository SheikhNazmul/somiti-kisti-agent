import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InstallmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    loan_id: int
    number: int
    due_date: date
    amount_due: Decimal
    amount_paid: Decimal
    paid_on: date | None
    collected_by: uuid.UUID | None


class InstallmentPay(BaseModel):
    amount: Decimal = Field(gt=0)
