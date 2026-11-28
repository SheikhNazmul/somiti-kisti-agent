from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.areas import repositories
from app.modules.areas.models import Area
from app.modules.areas.schemas import AreaCreate, AreaUpdate


async def create_area(session: AsyncSession, data: AreaCreate) -> Area:
    existing = await repositories.get_area_by_name(session, data.name)
    if existing is not None:
        raise ConflictError("An area with this name already exists")
    area = Area(name=data.name, collection_day=data.collection_day)
    return await repositories.create_area(session, area)


async def get_area(session: AsyncSession, area_id: int) -> Area:
    area = await repositories.get_area_by_id(session, area_id)
    if area is None:
        raise NotFoundError("Area not found")
    return area


async def list_areas(session: AsyncSession) -> list[Area]:
    return await repositories.list_areas(session)


async def update_area(
    session: AsyncSession, area_id: int, data: AreaUpdate
) -> Area:
    area = await get_area(session, area_id)
    if data.name is not None and data.name != area.name:
        existing = await repositories.get_area_by_name(session, data.name)
        if existing is not None:
            raise ConflictError("An area with this name already exists")
        area.name = data.name
    if data.collection_day is not None:
        area.collection_day = data.collection_day
    await session.flush()
    await session.refresh(area)
    return area


async def delete_area(session: AsyncSession, area_id: int) -> None:
    area = await get_area(session, area_id)
    member_count = await repositories.count_members(session, area_id)
    if member_count > 0:
        raise ConflictError("Area has members and cannot be deleted")
    await repositories.delete_area(session, area)
