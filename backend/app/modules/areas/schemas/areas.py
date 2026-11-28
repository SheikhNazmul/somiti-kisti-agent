from pydantic import BaseModel, ConfigDict

from app.modules.areas.models import CollectionDay


class AreaCreate(BaseModel):
    name: str
    collection_day: CollectionDay


class AreaUpdate(BaseModel):
    name: str | None = None
    collection_day: CollectionDay | None = None


class AreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    collection_day: CollectionDay
