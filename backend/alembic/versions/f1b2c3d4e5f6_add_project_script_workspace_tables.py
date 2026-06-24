"""add project script workspace tables

Revision ID: f1b2c3d4e5f6
Revises: c1f2e3d4a5b6
Create Date: 2026-05-18 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1b2c3d4e5f6"
down_revision: Union[str, None] = "c1f2e3d4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_scripts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("parsed_content", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("last_uploaded_filename", sa.String(length=255), nullable=True),
        sa.Column("last_uploaded_file_type", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )
    op.create_index(op.f("ix_project_scripts_project_id"), "project_scripts", ["project_id"], unique=False)

    op.create_table(
        "project_script_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("project_script_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["project_script_id"], ["project_scripts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_project_script_messages_project_script_id"),
        "project_script_messages",
        ["project_script_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_project_script_messages_project_script_id"), table_name="project_script_messages")
    op.drop_table("project_script_messages")
    op.drop_index(op.f("ix_project_scripts_project_id"), table_name="project_scripts")
    op.drop_table("project_scripts")
