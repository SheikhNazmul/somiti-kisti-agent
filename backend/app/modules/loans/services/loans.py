from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.loans import repositories
from app.modules.loans.calculations import build_installments, loan_totals
from app.modules.loans.models import Loan, LoanStatus
from app.modules.loans.schemas import LoanCreate
from app.modules.members import repositories as member_repositories
from app.modules.members.models import AccountType


async def create_loan(session: AsyncSession, data: LoanCreate) -> Loan:
    member = await member_repositories.get_member_by_id(
        session, data.member_id
    )
    if member is None:
        raise NotFoundError("Member not found")
    if member.account_type == AccountType.gata:
        raise ConflictError(
            "A gata-only member cannot take a loan"
        )
    active = await repositories.get_active_loan_for_member(
        session, data.member_id
    )
    if active is not None:
        raise ConflictError("Member already has an active loan")
    total, installment_amount = loan_totals(
        data.principal, data.service_charge_pct, data.num_installments
    )
    loan = Loan(
        member_id=data.member_id,
        principal=data.principal,
        service_charge_pct=data.service_charge_pct,
        total_payable=total,
        num_installments=data.num_installments,
        installment_amount=installment_amount,
        start_date=data.start_date,
        status=LoanStatus.active,
    )
    await repositories.add_loan(session, loan)
    installments = build_installments(
        loan.id,
        data.principal,
        data.service_charge_pct,
        data.num_installments,
        data.start_date,
    )
    await repositories.add_installments(session, installments)
    await session.refresh(loan)
    return loan


async def get_loan(session: AsyncSession, loan_id: int) -> Loan:
    loan = await repositories.get_loan_by_id(session, loan_id)
    if loan is None:
        raise NotFoundError("Loan not found")
    return loan


async def list_loans(
    session: AsyncSession,
    member_id: int | None = None,
    status: LoanStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Loan]:
    return await repositories.list_loans(
        session, member_id=member_id, status=status, limit=limit, offset=offset
    )


async def update_status(
    session: AsyncSession, loan_id: int, status: LoanStatus
) -> Loan:
    loan = await get_loan(session, loan_id)
    loan.status = status
    await session.flush()
    await session.refresh(loan)
    return loan


async def delete_loan(session: AsyncSession, loan_id: int) -> None:
    loan = await get_loan(session, loan_id)
    await repositories.delete_loan(session, loan)
