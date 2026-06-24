"""add asset recycle fields

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "assets" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("assets")}
    indexes = {index["name"] for index in inspector.get_indexes("assets")}

    if "is_deleted" not in columns:
        op.add_column(
            "assets",
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("assets", "is_deleted", server_default=None)
    if "deleted_at" not in columns:
        op.add_column("assets", sa.Column("deleted_at", sa.DateTime(), nullable=True))

    if "ix_assets_is_deleted" not in indexes:
        op.create_index("ix_assets_is_deleted", "assets", ["is_deleted"], unique=False)
    if "ix_assets_deleted_at" not in indexes:
        op.create_index("ix_assets_deleted_at", "assets", ["deleted_at"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "assets" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("assets")}
    indexes = {index["name"] for index in inspector.get_indexes("assets")}

    if "ix_assets_deleted_at" in indexes:
        op.drop_index("ix_assets_deleted_at", table_name="assets")
    if "ix_assets_is_deleted" in indexes:
        op.drop_index("ix_assets_is_deleted", table_name="assets")
    if "deleted_at" in columns:
        op.drop_column("assets", "deleted_at")
    if "is_deleted" in columns:
        op.drop_column("assets", "is_deleted")
