from fastapi import APIRouter, status

from app.db.session import SessionDep
from app.modules.areas import services
from app.modules.areas.models import Area
from app.modules.areas.schemas import AreaCreate, AreaOut, AreaUpdate
from app.modules.users.dependencies import AdminUser, CurrentUser

areas_router = APIRouter(prefix="/areas", tags=["areas"])


@areas_router.post(
    "", response_model=AreaOut, status_code=status.HTTP_201_CREATED
)
async def create_area(
    data: AreaCreate, session: SessionDep, admin: AdminUser
) -> Area:
    return await services.create_area(session, data)


@areas_router.get("", response_model=list[AreaOut])
async def list_areas(session: SessionDep, current_user: CurrentUser):
    return await services.list_areas(session)


@areas_router.get("/{area_id}", response_model=AreaOut)
async def get_area(
    area_id: int, session: SessionDep, current_user: CurrentUser
) -> Area:
    return await services.get_area(session, area_id)


@areas_router.patch("/{area_id}", response_model=AreaOut)
async def update_area(
    area_id: int, data: AreaUpdate, session: SessionDep, admin: AdminUser
) -> Area:
    return await services.update_area(session, area_id, data)


@areas_router.delete("/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_area(
    area_id: int, session: SessionDep, admin: AdminUser
) -> None:
    await services.delete_area(session, area_id)
