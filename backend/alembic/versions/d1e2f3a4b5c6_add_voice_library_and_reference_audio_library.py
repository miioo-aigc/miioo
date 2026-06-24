"""add voice library and reference audio library

Revision ID: d1e2f3a4b5c6
Revises: c2d3e4f5a6b7
Create Date: 2026-06-03 22:30:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_columns(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if table_name not in tables:
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    voice_columns = _get_columns("voices")
    if "is_enabled" not in voice_columns:
        op.add_column(
            "voices",
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        )
        op.alter_column("voices", "is_enabled", server_default=None)
    if "sort_order" not in voice_columns:
        op.add_column(
            "voices",
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("voices", "sort_order", server_default=None)
    if "created_by" not in voice_columns:
        op.add_column(
            "voices",
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if "updated_by" not in voice_columns:
        op.add_column(
            "voices",
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        )
    if "updated_at" not in voice_columns:
        op.add_column(
            "voices",
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.alter_column("voices", "updated_at", server_default=None)

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "reference_audio_library_items" not in tables:
        op.create_table(
            "reference_audio_library_items",
            sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("audio_url", sa.String(length=500), nullable=False),
            sa.Column("preview_url", sa.String(length=500), nullable=True),
            sa.Column("gender", sa.String(length=20), nullable=True),
            sa.Column("age_group", sa.String(length=30), nullable=True),
            sa.Column("language", sa.String(length=20), nullable=True),
            sa.Column("emotion", sa.String(length=50), nullable=True),
            sa.Column("tags_json", sa.JSON(), nullable=True),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        op.alter_column("reference_audio_library_items", "sort_order", server_default=None)
        op.alter_column("reference_audio_library_items", "is_enabled", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "reference_audio_library_items" in tables:
        op.drop_table("reference_audio_library_items")

    voice_columns = _get_columns("voices")
    if "updated_at" in voice_columns:
        op.drop_column("voices", "updated_at")
    if "updated_by" in voice_columns:
        op.drop_column("voices", "updated_by")
    if "created_by" in voice_columns:
        op.drop_column("voices", "created_by")
    if "sort_order" in voice_columns:
        op.drop_column("voices", "sort_order")
    if "is_enabled" in voice_columns:
        op.drop_column("voices", "is_enabled")
