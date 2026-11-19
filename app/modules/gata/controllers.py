from fastapi import APIRouter, Query, status

from app.db.session import SessionDep
from app.modules.gata import services
from app.modules.gata.models import GataGroup, GataGroupStatus
from app.modules.gata.schemas import (
    GataGroupCreate,
    GataGroupOut,
    GataMemberAdd,
    GataMemberOut,
    GataPaymentCreate,
    GataPaymentOut,
    GataPayoutOut,
    GataStatusOut,
)
from app.modules.users.dependencies import AdminUser, CurrentUser

gata_router = APIRouter(prefix="/gata/groups", tags=["gata"])


@gata_router.post(
    "", response_model=GataGroupOut, status_code=status.HTTP_201_CREATED
)
async def create_group(
    data: GataGroupCreate, session: SessionDep, admin: AdminUser
) -> GataGroup:
    return await services.create_group(session, data)


@gata_router.get("", response_model=list[GataGroupOut])
async def list_groups(
    session: SessionDep,
    current_user: CurrentUser,
    status: GataGroupStatus | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await services.list_groups(
        session, status=status, limit=limit, offset=offset
    )


@gata_router.get("/{group_id}", response_model=GataGroupOut)
async def get_group(
    group_id: int, session: SessionDep, current_user: CurrentUser
) -> GataGroup:
    return await services.get_group(session, group_id)


@gata_router.post(
    "/{group_id}/members",
    response_model=GataMemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    group_id: int,
    data: GataMemberAdd,
    session: SessionDep,
    admin: AdminUser,
) -> object:
    return await services.add_member(session, group_id, data.member_id)


@gata_router.post("/{group_id}/start", response_model=GataGroupOut)
async def start_group(
    group_id: int, session: SessionDep, admin: AdminUser
) -> GataGroup:
    return await services.start_group(session, group_id)


@gata_router.post(
    "/{group_id}/payments",
    response_model=GataPaymentOut,
    status_code=status.HTTP_201_CREATED,
)
async def record_payment(
    group_id: int,
    data: GataPaymentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> object:
    return await services.record_payment(
        session, group_id, data, current_user
    )


@gata_router.post("/{group_id}/payout", response_model=GataPayoutOut)
async def payout(
    group_id: int, session: SessionDep, admin: AdminUser
) -> GataPayoutOut:
    return await services.payout(session, group_id)


@gata_router.get("/{group_id}/status", response_model=GataStatusOut)
async def get_status(
    group_id: int, session: SessionDep, current_user: CurrentUser
) -> GataStatusOut:
    return await services.get_status(session, group_id)
