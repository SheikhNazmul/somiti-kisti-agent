import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimeStampMixin


class LoanStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    defaulted = "defaulted"


class Loan(Base, TimeStampMixin):
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("principal > 0", name="ck_loans_principal_positive"),
        CheckConstraint(
            "service_charge_pct >= 0", name="ck_loans_service_charge_non_negative"
        ),
        CheckConstraint(
            "total_payable > 0", name="ck_loans_total_payable_positive"
        ),
        CheckConstraint(
            "num_installments > 0", name="ck_loans_num_installments_positive"
        ),
        CheckConstraint(
            "installment_amount > 0", name="ck_loans_installment_amount_positive"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id"), nullable=False
    )
    principal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    service_charge_pct: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    total_payable: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    num_installments: Mapped[int] = mapped_column(Integer, nullable=False)
    installment_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[LoanStatus] = mapped_column(
        Enum(LoanStatus, name="loan_status", native_enum=False, length=20),
        nullable=False,
        default=LoanStatus.active,
    )
