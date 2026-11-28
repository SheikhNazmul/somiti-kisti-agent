import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimeStampMixin


class GataGroupStatus(str, enum.Enum):
    forming = "forming"
    running = "running"
    completed = "completed"


class GataFrequency(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class GataGroup(Base, TimeStampMixin):
    __tablename__ = "gata_groups"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_gata_groups_amount_positive"),
        CheckConstraint(
            "total_slots > 0", name="ck_gata_groups_total_slots_positive"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    frequency: Mapped[GataFrequency] = mapped_column(
        Enum(GataFrequency, name="gata_frequency", native_enum=False, length=10),
        nullable=False,
        default=GataFrequency.weekly,
    )
    total_slots: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[GataGroupStatus] = mapped_column(
        Enum(
            GataGroupStatus,
            name="gata_group_status",
            native_enum=False,
            length=20,
        ),
        nullable=False,
        default=GataGroupStatus.forming,
    )


class GataMember(Base, TimeStampMixin):
    __tablename__ = "gata_members"
    __table_args__ = (
        UniqueConstraint(
            "group_id", "member_id", name="uq_gata_members_group_member"
        ),
        UniqueConstraint(
            "group_id", "position", name="uq_gata_members_group_position"
        ),
        # In Postgres a unique constraint still allows many NULL rows,
        # so each round number can be won by only one member per group.
        UniqueConstraint(
            "group_id", "won_round", name="uq_gata_members_group_won_round"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("gata_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    has_won: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    won_round: Mapped[int | None] = mapped_column(Integer, nullable=True)


class GataPayment(Base, TimeStampMixin):
    __tablename__ = "gata_payments"
    __table_args__ = (
        UniqueConstraint(
            "group_id",
            "member_id",
            "round_number",
            name="uq_gata_payments_group_member_round",
        ),
        CheckConstraint("amount > 0", name="ck_gata_payments_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("gata_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id"), nullable=False
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_on: Mapped[date] = mapped_column(Date, nullable=False)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
