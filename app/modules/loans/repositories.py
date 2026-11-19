from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.installments.models import Installment
from app.modules.loans.models import Loan, LoanStatus


async def get_loan_by_id(session: AsyncSession, loan_id: int) -> Loan | None:
    return await session.get(Loan, loan_id)


async def get_active_loan_for_member(
    session: AsyncSession, member_id: int
) -> Loan | None:
    return await session.scalar(
        select(Loan).where(
            Loan.member_id == member_id, Loan.status == LoanStatus.active
        )
    )


async def list_loans(
    session: AsyncSession,
    member_id: int | None = None,
    status: LoanStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Loan]:
    query = select(Loan)
    if member_id is not None:
        query = query.where(Loan.member_id == member_id)
    if status is not None:
        query = query.where(Loan.status == status)
    query = query.order_by(Loan.id).limit(limit).offset(offset)
    result = await session.scalars(query)
    return list(result.all())


async def add_loan(session: AsyncSession, loan: Loan) -> Loan:
    session.add(loan)
    await session.flush()
    return loan


async def add_installments(
    session: AsyncSession, installments: list[Installment]
) -> None:
    session.add_all(installments)
    await session.flush()


async def delete_loan(session: AsyncSession, loan: Loan) -> None:
    await session.delete(loan)
    await session.flush()
