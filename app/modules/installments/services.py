from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.installments import repositories
from app.modules.installments.models import Installment
from app.modules.loans import repositories as loan_repositories
from app.modules.loans.models import LoanStatus
from app.modules.users.models import User


async def list_due(
    session: AsyncSession,
    on_date: date | None = None,
    area_id: int | None = None,
) -> list[Installment]:
    return await repositories.list_due(
        session, on_date or date.today(), area_id=area_id
    )


async def pay_installment(
    session: AsyncSession,
    installment_id: int,
    amount: Decimal,
    current_user: User,
) -> Installment:
    installment = await repositories.get_installment_by_id(
        session, installment_id
    )
    if installment is None:
        raise NotFoundError("Installment not found")
    remaining = installment.amount_due - installment.amount_paid
    if amount > remaining:
        raise ConflictError("Payment is more than the amount due")
    installment.amount_paid += amount
    installment.collected_by = current_user.id
    if installment.amount_paid == installment.amount_due:
        installment.paid_on = date.today()
    await session.flush()
    unpaid = await repositories.count_unpaid_for_loan(
        session, installment.loan_id
    )
    if unpaid == 0:
        loan = await loan_repositories.get_loan_by_id(
            session, installment.loan_id
        )
        if loan is not None and loan.status == LoanStatus.active:
            loan.status = LoanStatus.closed
            await session.flush()
    await session.refresh(installment)
    return installment
