from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.areas import repositories as area_repositories
from app.modules.members import repositories
from app.modules.members.models import AccountType, Member
from app.modules.members.schemas import (
    MemberBalanceOut,
    MemberCreate,
    MemberUpdate,
)

LOAN_TYPES = {AccountType.loan, AccountType.both}
GATA_TYPES = {AccountType.gata, AccountType.both}


async def create_member(session: AsyncSession, data: MemberCreate) -> Member:
    area = await area_repositories.get_area_by_id(session, data.area_id)
    if area is None:
        raise NotFoundError("Area not found")
    existing = await repositories.get_member_by_phone(session, data.phone)
    if existing is not None:
        raise ConflictError("A member with this phone already exists")
    member = Member(
        full_name=data.full_name,
        phone=data.phone,
        nid_last4=data.nid_last4,
        area_id=data.area_id,
        account_type=data.account_type,
        joined_on=data.joined_on,
    )
    return await repositories.create_member(session, member)


async def get_member(session: AsyncSession, member_id: int) -> Member:
    member = await repositories.get_member_by_id(session, member_id)
    if member is None:
        raise NotFoundError("Member not found")
    return member


async def list_members(
    session: AsyncSession,
    search: str | None = None,
    area_id: int | None = None,
    account_type: AccountType | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Member]:
    return await repositories.list_members(
        session,
        search=search,
        area_id=area_id,
        account_type=account_type,
        limit=limit,
        offset=offset,
    )


async def update_member(
    session: AsyncSession, member_id: int, data: MemberUpdate
) -> Member:
    member = await get_member(session, member_id)
    if data.phone is not None and data.phone != member.phone:
        existing = await repositories.get_member_by_phone(session, data.phone)
        if existing is not None:
            raise ConflictError("A member with this phone already exists")
        member.phone = data.phone
    if data.area_id is not None and data.area_id != member.area_id:
        area = await area_repositories.get_area_by_id(session, data.area_id)
        if area is None:
            raise NotFoundError("Area not found")
        member.area_id = data.area_id
    for field in ("full_name", "nid_last4", "joined_on", "is_active"):
        value = getattr(data, field)
        if value is not None:
            setattr(member, field, value)
    await session.flush()
    await session.refresh(member)
    return member


async def delete_member(session: AsyncSession, member_id: int) -> None:
    member = await get_member(session, member_id)
    await repositories.delete_member(session, member)


async def change_account_type(
    session: AsyncSession, member_id: int, new_type: AccountType
) -> Member:
    member = await get_member(session, member_id)
    current = member.account_type
    if new_type == current:
        return member
    drops_loan = current in LOAN_TYPES and new_type not in LOAN_TYPES
    drops_gata = current in GATA_TYPES and new_type not in GATA_TYPES
    if drops_gata and await repositories.is_in_running_gata(session, member_id):
        raise ConflictError(
            "Member is in a running gata group and cannot leave gata"
        )
    if drops_loan and await repositories.has_active_loan(session, member_id):
        raise ConflictError(
            "Member has an active loan and cannot leave loan"
        )
    member.account_type = new_type
    await session.flush()
    await session.refresh(member)
    return member


async def get_balance(
    session: AsyncSession, member_id: int
) -> MemberBalanceOut:
    await get_member(session, member_id)
    total, paid = await repositories.loan_balance(session, member_id)
    return MemberBalanceOut(
        member_id=member_id,
        loan_total=total,
        total_paid=paid,
        remaining=total - paid,
    )
