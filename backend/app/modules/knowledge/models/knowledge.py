from pgvector.sqlalchemy import Vector
from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimeStampMixin

# Must match EMBEDDING_DIM in the settings: stored vectors and query
# vectors have to use the same number of dimensions.
EMBEDDING_DIMENSIONS = 768


class KnowledgeChunk(Base, TimeStampMixin):
    """One small piece of a knowledge document, with its embedding.

    The chat assistant searches these rows by vector similarity to answer
    questions about the somiti's rules (RAG). The rows are written by the
    ingest step only; the assistant itself never changes them.
    """

    __tablename__ = "knowledge_chunks"
    __table_args__ = (
        UniqueConstraint("source", "chunk_index", name="uq_knowledge_chunk"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source: Mapped[str] = mapped_column(String(120), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(
        Vector(EMBEDDING_DIMENSIONS), nullable=False
    )
