from datetime import date

from fastapi import APIRouter, Query

from app.db.session import SessionDep
from app.modules.installments import services
from app.modules.installments.models import Installment
from app.modules.installments.schemas import InstallmentOut, InstallmentPay
from app.modules.users.dependencies import CurrentUser

installments_router = APIRouter(prefix="/installments", tags=["installments"])


@installments_router.get("/due", response_model=list[InstallmentOut])
async def list_due(
    session: SessionDep,
    current_user: CurrentUser,
    area_id: int | None = None,
    on_date: date | None = Query(None, alias="date"),
):
    return await services.list_due(session, on_date=on_date, area_id=area_id)


@installments_router.post(
    "/{installment_id}/pay", response_model=InstallmentOut
)
async def pay_installment(
    installment_id: int,
    data: InstallmentPay,
    session: SessionDep,
    current_user: CurrentUser,
) -> Installment:
    return await services.pay_installment(
        session, installment_id, data.amount, current_user
    )
