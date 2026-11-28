from fastapi import APIRouter, Query, status

from app.db.session import SessionDep
from app.modules.members import services
from app.modules.members.models import AccountType, Member
from app.modules.members.schemas import (
    AccountTypeUpdate,
    MemberBalanceOut,
    MemberCreate,
    MemberOut,
    MemberUpdate,
)
from app.modules.users.dependencies import AdminOrManagerUser, AdminUser, CurrentUser

members_router = APIRouter(prefix="/members", tags=["members"])


@members_router.post(
    "", response_model=MemberOut, status_code=status.HTTP_201_CREATED
)
async def create_member(
    data: MemberCreate, session: SessionDep, admin: AdminOrManagerUser
) -> Member:
    return await services.create_member(session, data)


@members_router.get("", response_model=list[MemberOut])
async def list_members(
    session: SessionDep,
    current_user: CurrentUser,
    search: str | None = None,
    area_id: int | None = None,
    account_type: AccountType | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    return await services.list_members(
        session,
        search=search,
        area_id=area_id,
        account_type=account_type,
        limit=limit,
        offset=offset,
    )


@members_router.get("/{member_id}", response_model=MemberOut)
async def get_member(
    member_id: int, session: SessionDep, current_user: CurrentUser
) -> Member:
    return await services.get_member(session, member_id)


@members_router.patch("/{member_id}", response_model=MemberOut)
async def update_member(
    member_id: int, data: MemberUpdate, session: SessionDep, admin: AdminOrManagerUser
) -> Member:
    return await services.update_member(session, member_id, data)


@members_router.delete(
    "/{member_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_member(
    member_id: int, session: SessionDep, admin: AdminUser
) -> None:
    await services.delete_member(session, member_id)


@members_router.patch(
    "/{member_id}/account-type", response_model=MemberOut
)
async def change_account_type(
    member_id: int,
    data: AccountTypeUpdate,
    session: SessionDep,
    admin: AdminUser,
) -> Member:
    return await services.change_account_type(
        session, member_id, data.account_type
    )


@members_router.get("/{member_id}/balance", response_model=MemberBalanceOut)
async def get_balance(
    member_id: int, session: SessionDep, current_user: CurrentUser
):
    return await services.get_balance(session, member_id)
