from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.installments.models import Installment
from app.modules.loans.models import Loan
from app.modules.members.models import Member


async def get_installment_by_id(
    session: AsyncSession, installment_id: int
) -> Installment | None:
    return await session.get(Installment, installment_id)


async def list_due(
    session: AsyncSession,
    on_date: date,
    area_id: int | None = None,
) -> list[Installment]:
    query = (
        select(Installment)
        .join(Loan, Installment.loan_id == Loan.id)
        .where(
            Installment.due_date <= on_date,
            Installment.amount_paid < Installment.amount_due,
        )
    )
    if area_id is not None:
        query = query.join(Member, Loan.member_id == Member.id).where(
            Member.area_id == area_id
        )
    query = query.order_by(Installment.due_date, Installment.id)
    result = await session.scalars(query)
    return list(result.all())


async def count_unpaid_for_loan(session: AsyncSession, loan_id: int) -> int:
    result = await session.scalars(
        select(Installment).where(
            Installment.loan_id == loan_id,
            Installment.amount_paid < Installment.amount_due,
        )
    )
    return len(result.all())
