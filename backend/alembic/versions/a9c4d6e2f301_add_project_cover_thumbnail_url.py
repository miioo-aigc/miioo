"""add project cover thumbnail url

Revision ID: a9c4d6e2f301
Revises: f2a4c6e8b901
Create Date: 2026-06-02 16:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9c4d6e2f301"
down_revision: Union[str, None] = "f2a4c6e8b901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "projects" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "cover_thumbnail_url" not in columns:
        op.add_column("projects", sa.Column("cover_thumbnail_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "projects" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("projects")}
    if "cover_thumbnail_url" in columns:
        op.drop_column("projects", "cover_thumbnail_url")
