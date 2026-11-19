from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.loans.models import LoanStatus


class LoanCreate(BaseModel):
    member_id: int
    principal: Decimal = Field(gt=0)
    service_charge_pct: Decimal = Field(ge=0, le=50)
    num_installments: int = Field(gt=0)
    start_date: date


class LoanStatusUpdate(BaseModel):
    status: LoanStatus


class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_id: int
    principal: Decimal
    service_charge_pct: Decimal
    total_payable: Decimal
    num_installments: int
    installment_amount: Decimal
    start_date: date
    status: LoanStatus
