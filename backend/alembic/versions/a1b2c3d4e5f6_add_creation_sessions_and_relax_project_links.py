"""add creation sessions shots and relax project links

Revision ID: a1b2c3d4e5f6
Revises: f9a7b2c3d456, c1f2e3d4a5b6
Create Date: 2026-05-15 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, tuple[str, str], None] = ("f9a7b2c3d456", "c1f2e3d4a5b6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "creation_sessions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("aspect_ratio", sa.String(length=10), nullable=False, server_default="16:9"),
        sa.Column("visual_style", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_creation_sessions_user_id"), "creation_sessions", ["user_id"], unique=False)
    op.create_index(op.f("ix_creation_sessions_project_id"), "creation_sessions", ["project_id"], unique=False)

    op.create_table(
        "creation_shots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=True),
        sa.Column("shot_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("shot_type", sa.String(length=20), nullable=True),
        sa.Column("camera", sa.String(length=20), nullable=True),
        sa.Column("camera_angle", sa.String(length=20), nullable=True),
        sa.Column("composition", sa.String(length=20), nullable=True),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("audio_url", sa.String(length=500), nullable=True),
        sa.Column("video_url", sa.String(length=500), nullable=True),
        sa.Column("reference_image_urls", sa.JSON(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["creation_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_creation_shots_session_id"), "creation_shots", ["session_id"], unique=False)
    op.create_index(op.f("ix_creation_shots_project_id"), "creation_shots", ["project_id"], unique=False)

    with op.batch_alter_table("gen_tasks") as batch_op:
        batch_op.drop_constraint("gen_tasks_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=True)
        batch_op.create_foreign_key(
            "gen_tasks_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("audio_clips") as batch_op:
        batch_op.drop_constraint("audio_clips_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=True)
        batch_op.create_foreign_key(
            "audio_clips_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="SET NULL",
        )

    with op.batch_alter_table("video_clips") as batch_op:
        batch_op.drop_constraint("video_clips_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=True)
        batch_op.create_foreign_key(
            "video_clips_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    op.execute("DELETE FROM video_clips WHERE project_id IS NULL")
    op.execute("DELETE FROM audio_clips WHERE project_id IS NULL")
    op.execute("DELETE FROM gen_tasks WHERE project_id IS NULL")

    with op.batch_alter_table("video_clips") as batch_op:
        batch_op.drop_constraint("video_clips_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=False)
        batch_op.create_foreign_key(
            "video_clips_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("audio_clips") as batch_op:
        batch_op.drop_constraint("audio_clips_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=False)
        batch_op.create_foreign_key(
            "audio_clips_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    with op.batch_alter_table("gen_tasks") as batch_op:
        batch_op.drop_constraint("gen_tasks_project_id_fkey", type_="foreignkey")
        batch_op.alter_column("project_id", existing_type=sa.UUID(), nullable=False)
        batch_op.create_foreign_key(
            "gen_tasks_project_id_fkey",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )

    op.drop_index(op.f("ix_creation_shots_project_id"), table_name="creation_shots")
    op.drop_index(op.f("ix_creation_shots_session_id"), table_name="creation_shots")
    op.drop_table("creation_shots")

    op.drop_index(op.f("ix_creation_sessions_project_id"), table_name="creation_sessions")
    op.drop_index(op.f("ix_creation_sessions_user_id"), table_name="creation_sessions")
    op.drop_table("creation_sessions")
