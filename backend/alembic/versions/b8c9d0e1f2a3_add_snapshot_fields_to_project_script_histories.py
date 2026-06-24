"""add snapshot fields to project_script_histories

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-05-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "project_script_histories" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("project_script_histories")}

    if "snapshot_type" not in columns:
        op.add_column(
            "project_script_histories",
            sa.Column(
                "snapshot_type",
                sa.String(length=30),
                nullable=False,
                server_default="script_content",
            ),
        )
        op.alter_column("project_script_histories", "snapshot_type", server_default=None)

    if "snapshot_payload" not in columns:
        op.add_column(
            "project_script_histories",
            sa.Column("snapshot_payload", sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "project_script_histories" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("project_script_histories")}
    if "snapshot_payload" in columns:
        op.drop_column("project_script_histories", "snapshot_payload")
    if "snapshot_type" in columns:
        op.drop_column("project_script_histories", "snapshot_type")
