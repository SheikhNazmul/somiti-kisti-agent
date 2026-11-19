import enum
from datetime import date

from sqlalchemy import Boolean, Date, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimeStampMixin


class AccountType(str, enum.Enum):
    loan = "loan"
    gata = "gata"
    both = "both"


class Member(Base, TimeStampMixin):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(
        String(120), nullable=False, index=True
    )
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nid_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    area_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("areas.id"), nullable=False
    )
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type", native_enum=False, length=10),
        nullable=False,
    )
    joined_on: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
