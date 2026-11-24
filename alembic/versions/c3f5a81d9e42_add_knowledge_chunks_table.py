"""add knowledge chunks table for rag search

Revision ID: c3f5a81d9e42
Revises: 8890f02c6419
Create Date: 2026-11-24 18:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import pgvector.sqlalchemy
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f5a81d9e42'
down_revision: Union[str, Sequence[str], None] = '8890f02c6419'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('knowledge_chunks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(length=120), nullable=False),
    sa.Column('chunk_index', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.Vector(768), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source', 'chunk_index', name='uq_knowledge_chunk')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('knowledge_chunks')
