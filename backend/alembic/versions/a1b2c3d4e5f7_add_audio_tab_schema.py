"""add audio tab schema

Revision ID: a1b2c3d4e5f7
Revises: 1b2c3d4e5f67
Create Date: 2026-05-16 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "1b2c3d4e5f67"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create voice_favorites table
    op.create_table(
        "voice_favorites",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("voice_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["voice_id"], ["voices.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "voice_id", name="uq_voice_favorites_user_voice"),
    )
    op.create_index("ix_voice_favorites_user_id", "voice_favorites", ["user_id"])

    # Add columns to voices table
    op.add_column("voices", sa.Column("emotions", sa.String(500), nullable=True))
    op.add_column("voices", sa.Column("is_custom", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("voices", sa.Column("owner_user_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_voices_owner_user_id", "voices", "users", ["owner_user_id"], ["id"], ondelete="SET NULL")

    # Add columns to audio_clips table
    op.add_column("audio_clips", sa.Column("is_favorite", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("audio_clips", sa.Column("source", sa.String(50), nullable=True))


def downgrade() -> None:
    # Remove columns from audio_clips
    op.drop_column("audio_clips", "source")
    op.drop_column("audio_clips", "is_favorite")

    # Remove columns from voices
    op.drop_constraint("fk_voices_owner_user_id", "voices", type_="foreignkey")
    op.drop_column("voices", "owner_user_id")
    op.drop_column("voices", "is_custom")
    op.drop_column("voices", "emotions")

    # Drop voice_favorites table
    op.drop_index("ix_voice_favorites_user_id", table_name="voice_favorites")
    op.drop_table("voice_favorites")
