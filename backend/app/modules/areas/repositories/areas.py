from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.areas.models import Area
from app.modules.members.models import Member


async def get_area_by_id(session: AsyncSession, area_id: int) -> Area | None:
    return await session.get(Area, area_id)


async def get_area_by_name(
    session: AsyncSession, name: str
) -> Area | None:
    return await session.scalar(select(Area).where(Area.name == name))


async def list_areas(session: AsyncSession) -> list[Area]:
    result = await session.scalars(select(Area).order_by(Area.id))
    return list(result.all())


async def create_area(session: AsyncSession, area: Area) -> Area:
    session.add(area)
    await session.flush()
    await session.refresh(area)
    return area


async def delete_area(session: AsyncSession, area: Area) -> None:
    await session.delete(area)
    await session.flush()


async def count_members(session: AsyncSession, area_id: int) -> int:
    return await session.scalar(
        select(func.count())
        .select_from(Member)
        .where(Member.area_id == area_id)
    )
