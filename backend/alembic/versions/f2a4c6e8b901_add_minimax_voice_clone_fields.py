"""add minimax voice clone fields

Revision ID: f2a4c6e8b901
Revises: e5f6a7b8c9d0
Create Date: 2026-06-01 15:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f2a4c6e8b901"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "voices" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("voices")}
    if "provider_voice_id" not in columns:
        op.add_column("voices", sa.Column("provider_voice_id", sa.String(length=100), nullable=True))
    if "clone_status" not in columns:
        op.add_column("voices", sa.Column("clone_status", sa.String(length=20), nullable=True))
    if "source_audio_url" not in columns:
        op.add_column("voices", sa.Column("source_audio_url", sa.String(length=500), nullable=True))
    if "provider_file_id" not in columns:
        op.add_column("voices", sa.Column("provider_file_id", sa.String(length=200), nullable=True))
    if "provider_task_id" not in columns:
        op.add_column("voices", sa.Column("provider_task_id", sa.String(length=200), nullable=True))
    if "expires_at" not in columns:
        op.add_column("voices", sa.Column("expires_at", sa.DateTime(), nullable=True))
    if "metadata_json" not in columns:
        op.add_column("voices", sa.Column("metadata_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "voices" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("voices")}
    if "metadata_json" in columns:
        op.drop_column("voices", "metadata_json")
    if "expires_at" in columns:
        op.drop_column("voices", "expires_at")
    if "provider_task_id" in columns:
        op.drop_column("voices", "provider_task_id")
    if "provider_file_id" in columns:
        op.drop_column("voices", "provider_file_id")
    if "source_audio_url" in columns:
        op.drop_column("voices", "source_audio_url")
    if "clone_status" in columns:
        op.drop_column("voices", "clone_status")
    if "provider_voice_id" in columns:
        op.drop_column("voices", "provider_voice_id")
