from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    source: str
    chunks: int


class KnowledgeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class KnowledgeHit(BaseModel):
    source: str
    content: str
    distance: float


class KnowledgeSearchResponse(BaseModel):
    results: list[KnowledgeHit]
