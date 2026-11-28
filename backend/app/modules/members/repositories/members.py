from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.gata.models import GataGroup, GataGroupStatus, GataMember
from app.modules.installments.models import Installment
from app.modules.loans.models import Loan, LoanStatus
from app.modules.members.models import AccountType, Member


async def get_member_by_id(
    session: AsyncSession, member_id: int
) -> Member | None:
    return await session.get(Member, member_id)


async def get_member_by_phone(
    session: AsyncSession, phone: str
) -> Member | None:
    return await session.scalar(select(Member).where(Member.phone == phone))


async def list_members(
    session: AsyncSession,
    search: str | None = None,
    area_id: int | None = None,
    account_type: AccountType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Member]:
    query = select(Member)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Member.full_name.ilike(pattern),
                Member.phone.ilike(pattern),
            )
        )
    if area_id is not None:
        query = query.where(Member.area_id == area_id)
    if account_type is not None:
        query = query.where(Member.account_type == account_type)
    query = query.order_by(Member.id).limit(limit).offset(offset)
    result = await session.scalars(query)
    return list(result.all())


async def create_member(session: AsyncSession, member: Member) -> Member:
    session.add(member)
    await session.flush()
    await session.refresh(member)
    return member


async def delete_member(session: AsyncSession, member: Member) -> None:
    await session.delete(member)
    await session.flush()


async def has_active_loan(session: AsyncSession, member_id: int) -> bool:
    loan_id = await session.scalar(
        select(Loan.id).where(
            Loan.member_id == member_id, Loan.status == LoanStatus.active
        )
    )
    return loan_id is not None


async def is_in_running_gata(session: AsyncSession, member_id: int) -> bool:
    gata_member_id = await session.scalar(
        select(GataMember.id)
        .join(GataGroup, GataMember.group_id == GataGroup.id)
        .where(
            GataMember.member_id == member_id,
            GataGroup.status == GataGroupStatus.running,
        )
    )
    return gata_member_id is not None


async def loan_balance(
    session: AsyncSession, member_id: int
) -> tuple[Decimal, Decimal]:
    total = await session.scalar(
        select(func.coalesce(func.sum(Loan.total_payable), 0)).where(
            Loan.member_id == member_id
        )
    )
    paid = await session.scalar(
        select(func.coalesce(func.sum(Installment.amount_paid), 0))
        .join(Loan, Installment.loan_id == Loan.id)
        .where(Loan.member_id == member_id)
    )
    return Decimal(total), Decimal(paid)
