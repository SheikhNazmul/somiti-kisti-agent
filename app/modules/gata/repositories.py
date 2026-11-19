from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.gata.models import (
    GataGroup,
    GataGroupStatus,
    GataMember,
    GataPayment,
)


async def get_group_by_id(
    session: AsyncSession, group_id: int
) -> GataGroup | None:
    return await session.get(GataGroup, group_id)


async def get_group_by_name(
    session: AsyncSession, name: str
) -> GataGroup | None:
    return await session.scalar(
        select(GataGroup).where(GataGroup.name == name)
    )


async def list_groups(
    session: AsyncSession,
    status: GataGroupStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[GataGroup]:
    query = select(GataGroup)
    if status is not None:
        query = query.where(GataGroup.status == status)
    query = query.order_by(GataGroup.id).limit(limit).offset(offset)
    result = await session.scalars(query)
    return list(result.all())


async def add_group(session: AsyncSession, group: GataGroup) -> GataGroup:
    session.add(group)
    await session.flush()
    return group


async def list_members(
    session: AsyncSession, group_id: int
) -> list[GataMember]:
    result = await session.scalars(
        select(GataMember)
        .where(GataMember.group_id == group_id)
        .order_by(GataMember.position)
    )
    return list(result.all())


async def count_members(session: AsyncSession, group_id: int) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(GataMember)
        .where(GataMember.group_id == group_id)
    )
    return result.scalar_one()


async def get_gata_member(
    session: AsyncSession, group_id: int, member_id: int
) -> GataMember | None:
    return await session.scalar(
        select(GataMember).where(
            GataMember.group_id == group_id,
            GataMember.member_id == member_id,
        )
    )


async def add_gata_member(
    session: AsyncSession, gata_member: GataMember
) -> GataMember:
    session.add(gata_member)
    await session.flush()
    return gata_member


async def get_payment(
    session: AsyncSession, group_id: int, member_id: int, round_number: int
) -> GataPayment | None:
    return await session.scalar(
        select(GataPayment).where(
            GataPayment.group_id == group_id,
            GataPayment.member_id == member_id,
            GataPayment.round_number == round_number,
        )
    )


async def list_payments_for_round(
    session: AsyncSession, group_id: int, round_number: int
) -> list[GataPayment]:
    result = await session.scalars(
        select(GataPayment).where(
            GataPayment.group_id == group_id,
            GataPayment.round_number == round_number,
        )
    )
    return list(result.all())


async def add_payment(
    session: AsyncSession, payment: GataPayment
) -> GataPayment:
    session.add(payment)
    await session.flush()
    return payment
