from fastapi import APIRouter, Query, status

from app.db.session import SessionDep
from app.modules.loans import services
from app.modules.loans.models import Loan, LoanStatus
from app.modules.loans.schemas import LoanCreate, LoanOut, LoanStatusUpdate
from app.modules.users.dependencies import AdminUser, CurrentUser

loans_router = APIRouter(prefix="/loans", tags=["loans"])


@loans_router.post(
    "", response_model=LoanOut, status_code=status.HTTP_201_CREATED
)
async def create_loan(
    data: LoanCreate, session: SessionDep, admin: AdminUser
) -> Loan:
    return await services.create_loan(session, data)


@loans_router.get("", response_model=list[LoanOut])
async def list_loans(
    session: SessionDep,
    current_user: CurrentUser,
    member_id: int | None = None,
    status: LoanStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await services.list_loans(
        session, member_id=member_id, status=status, limit=limit, offset=offset
    )


@loans_router.get("/{loan_id}", response_model=LoanOut)
async def get_loan(
    loan_id: int, session: SessionDep, current_user: CurrentUser
) -> Loan:
    return await services.get_loan(session, loan_id)


@loans_router.patch("/{loan_id}/status", response_model=LoanOut)
async def update_status(
    loan_id: int,
    data: LoanStatusUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> Loan:
    return await services.update_status(session, loan_id, data.status)


@loans_router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loan(
    loan_id: int, session: SessionDep, admin: AdminUser
) -> None:
    await services.delete_loan(session, loan_id)
