import enum

from sqlalchemy import Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimeStampMixin


class CollectionDay(str, enum.Enum):
    sat = "sat"
    sun = "sun"
    mon = "mon"
    tue = "tue"
    wed = "wed"
    thu = "thu"
    fri = "fri"


class Area(Base, TimeStampMixin):
    __tablename__ = "areas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    collection_day: Mapped[CollectionDay] = mapped_column(
        Enum(CollectionDay, name="collection_day", native_enum=False, length=10),
        nullable=False,
    )
